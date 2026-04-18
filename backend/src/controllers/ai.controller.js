const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

// ===== CHAT WITH AI =====
exports.chat = async (req, res, next) => {
  try {
    const { message, language = 'en', history = [] } = req.body;
    if (!message) throw new AppError('Message is required.', 400);

    const systemPrompt = buildSystemPrompt(language);

    // Try Groq (free, fast)
    if (process.env.GROQ_API_KEY) {
      try {
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: message },
        ];
        const completion = await groq.chat.completions.create({
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          messages,
          max_tokens: 500,
          temperature: 0.7,
        });
        const reply = completion.choices[0].message.content;
        return res.json({ success: true, data: { reply, language, provider: 'groq' } });
      } catch (groqErr) {
        logger.warn('Groq failed:', groqErr.message);
      }
    }

    // Rule-based fallback
    const reply = getRuleBasedReply(message, language);
    res.json({ success: true, data: { reply, language, provider: 'fallback' } });

  } catch (err) {
    next(err);
  }
};
// ===== PRODUCT RECOMMENDATIONS =====
exports.getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    let products;

    if (userId) {
      // Get user's order history categories
      const orderItems = await prisma.orderItem.findMany({
        where: { order: { userId } },
        include: { product: { select: { categoryId: true } } },
        take: 20, orderBy: { order: { createdAt: 'desc' } },
      });

      const categoryIds = [...new Set(orderItems.map(i => i.product.categoryId))];

      if (categoryIds.length) {
        products = await prisma.product.findMany({
          where: { status: 'ACTIVE', categoryId: { in: categoryIds },
                   id: { notIn: orderItems.map(i => i.productId) } },
          take: 12, orderBy: { rating: 'desc' },
          include: { seller: { select: { storeName:true } }, category: { select: { name:true, emoji:true } } },
        });
      }
    }

    // Fallback to featured/top-rated
    if (!products?.length) {
      products = await prisma.product.findMany({
        where: { status: 'ACTIVE', isFeatured: true },
        take: 12, orderBy: { soldCount: 'desc' },
        include: { seller: { select: { storeName:true } }, category: { select: { name:true, emoji:true } } },
      });
    }

    res.json({ success: true, data: products });
  } catch (err) { next(err); }
};

// ===== SIMILAR PRODUCTS =====
exports.getSimilarProducts = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) throw new AppError('Product not found.', 404);

    const similar = await prisma.product.findMany({
      where: { status: 'ACTIVE', categoryId: product.categoryId, id: { not: product.id } },
      take: 8, orderBy: { rating: 'desc' },
      include: { seller: { select: { storeName:true } } },
    });

    res.json({ success: true, data: similar });
  } catch (err) { next(err); }
};

// ===== VISUAL SEARCH (image → product) — powered by Groq vision =====
exports.analyzeImage = async (req, res, next) => {
  try {
    const { imageUrl, imageBase64 } = req.body;
    if (!imageUrl && !imageBase64) throw new AppError('imageUrl or imageBase64 is required.', 400);

    let searchQuery = '';
    let identified = { name: 'Unknown', category: '', description: '' };

    // Use Groq with llama-3.2-11b-vision-preview (free, supports images)
    if (process.env.GROQ_API_KEY) {
      try {
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const imageContent = imageBase64
          ? { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          : { type: 'image_url', image_url: { url: imageUrl } };

        const completion = await groq.chat.completions.create({
          model: 'llama-3.2-11b-vision-preview',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'You are a product identifier for an Ethiopian agricultural marketplace. Look at this image and identify the agricultural product. Reply with ONLY valid JSON in this exact format: {"name":"product name in English","nameAm":"product name in Amharic if known","category":"one of: vegetables/fruits/grains/spices/poultry/meat/coffee/specialty","searchQuery":"best 1-2 word search term","confidence":"high/medium/low"}',
              },
              imageContent,
            ],
          }],
          max_tokens: 150,
          temperature: 0.1,
        });

        const raw = completion.choices[0].message.content.trim();
        // Extract JSON even if wrapped in markdown
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          identified = parsed;
          searchQuery = parsed.searchQuery || parsed.name || '';
        }
      } catch (visionErr) {
        logger.warn('Groq vision failed, using keyword fallback:', visionErr.message);
        // Fallback: return empty results with a helpful message
        return res.json({
          success: true,
          data: {
            identified: { name: 'Could not identify', confidence: 'low' },
            products: [],
            message: 'Image recognition unavailable. Try searching by name.',
          },
        });
      }
    }

    // Search for matching products using the identified query
    let products = [];
    if (searchQuery) {
      const terms = searchQuery.toLowerCase().split(' ').filter(Boolean);
      products = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { nameAm: { contains: searchQuery, mode: 'insensitive' } },
            ...terms.map(t => ({ tags: { has: t } })),
            ...(identified.category ? [{ category: { slug: { contains: identified.category, mode: 'insensitive' } } }] : []),
          ],
        },
        take: 8,
        orderBy: { soldCount: 'desc' },
        include: {
          seller: { select: { storeName: true } },
          category: { select: { name: true, emoji: true } },
        },
      });
    }

    res.json({ success: true, data: { identified, products, searchQuery } });
  } catch (err) { next(err); }
};

// ===== SYSTEM PROMPT BUILDER =====
function buildSystemPrompt(language) {
  const langInstructions = {
    en: 'Respond in English.',
    am: 'Respond in Amharic (áŠ áˆ›áˆ­áŠ›).',
    om: 'Respond in Afaan Oromoo.',
    sw: 'Respond in Kiswahili.',
    fr: 'Respond in French.',
    ar: 'Respond in Arabic.',
  };

  return `You are Hafa AI, the intelligent assistant for Hafa Market â€” Africa's premier agricultural e-commerce platform.

${langInstructions[language] || langInstructions.en}

About Hafa Market:
- Online marketplace for fresh vegetables, fruits, grains, legumes, spices, coffee, honey, meat, dairy, and more
- Connects local African farmers directly with buyers
- Covers 30+ cities across Ethiopia, Kenya, Ghana, Nigeria, Senegal
- Free delivery on orders over $50, 24-48 hour delivery
- Payment: M-Pesa, Flutterwave, Card, Cash on Delivery
- 7-day return policy, 98% satisfaction rate
- Promo code HAFA10 for 10% off first order

Categories: Vegetables, Fruits, Grains, Legumes, Spices & Herbs, Poultry & Dairy, Livestock & Meat, Coffee & Beverages, Specialty Products (Honey, Moringa), Processed Foods (Doro Wot, Injera), Household, Services

Be helpful, friendly, and concise. Help users find products, track orders, understand policies, and navigate the platform. If asked about specific orders, ask for the order number.`;
}

// ===== RULE-BASED FALLBACK =====
function getRuleBasedReply(message, language) {
  const m = (message || '').toLowerCase();
  const replies = {
    en: {
      delivery: "We deliver in 24â€“48 hours to 30+ cities. Free delivery on orders over $50! ðŸšš",
      payment: "We accept M-Pesa, Flutterwave, Credit/Debit Card, and Cash on Delivery. ðŸ’³",
      return: "We have a 7-day return policy. Contact support with your order number. â†©ï¸",
      default: "Hi! I'm Hafa AI. I can help with products, delivery, payments, and more. What do you need? ðŸŒ¿",
    },
  };
  const r = replies[language] || replies.en;
  if (/deliver|ship/.test(m)) return r.delivery;
  if (/pay|mpesa|card/.test(m)) return r.payment;
  if (/return|refund/.test(m)) return r.return;
  return r.default;
}

// ===== RECOMMENDATION ENGINE (new multi-algorithm system) =====
exports.getEngineRecommendations = async (req, res, next) => {
  try {
    const { context = 'homepage', productId, city, categoryId, limit = 10, sessionId } = req.query;
    const userId = req.user?.id;

    const { getHybridRecommendations } = require('../services/twoTower.service');
    const recommendations = await getHybridRecommendations(userId, context, {
      productId, city, categoryId, limit: parseInt(limit), sessionId,
    });

    res.json({
      success: true,
      data: recommendations,
      context,
      algorithm: 'two_tower_hybrid', // Two-Tower + collaborative + co-occurrence
    });
  } catch (err) { next(err); }
};

// ===== REAL-TIME CLICK TRACKING (updates user vector instantly) =====
exports.trackRecommendationClick = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const userId = req.user?.id;
    if (!productId) return res.json({ success: false });

    const { updateUserVectorOnClick } = require('../services/twoTower.service');
    await updateUserVectorOnClick(userId, productId);

    res.json({ success: true });
  } catch (err) { next(err); }
};

// ===== USER VECTOR INSPECTOR (for debugging/admin) =====
exports.getUserVector = async (req, res, next) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ success: false });
    const { userId } = req.params;

    const { buildUserVector, getSessionData } = require('../services/twoTower.service');
    const sessionData = await getSessionData(userId, null);
    const vector = await buildUserVector(userId, sessionData);

    const DIMS_LABELS = [
      'category_affinity', 'price_tier', 'is_organic', 'rating',
      'sales_velocity', 'freshness', 'seasonal_boost', 'seller_trust',
      'category_pref', 'price_sensitivity', 'organic_pref', 'quality_pref',
      'recency_bias', 'freshness_pref', 'seasonal_pref', 'loyalty_score',
    ];

    const labeled = Object.fromEntries(vector.map((v, i) => [DIMS_LABELS[i], parseFloat(v.toFixed(3))]));
    res.json({ success: true, data: { userId, vector: labeled, sessionData } });
  } catch (err) { next(err); }
};
