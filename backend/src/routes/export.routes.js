'use strict';
const router  = require('express').Router();
const prisma  = require('../config/prisma');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');
const { createNotification } = require('../services/notification.service');
const crypto  = require('crypto');
const logger  = require('../config/logger');

const EXPORT_CATEGORIES = [
  'COFFEE','TEFF','HONEY','SPICES','AVOCADO','SESAME',
  'LEATHER','FLOWERS','PULSES','OIL_SEEDS','OTHER'
];

// ── LISTINGS ──────────────────────────────────────────────────────────────────

router.get('/listings', optionalAuth, async (req, res, next) => {
  try {
    const { category, origin, minQty, maxPrice, page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = `WHERE el.status = 'ACTIVE'`;
    if (category) whereClause += ` AND el.category = '${category}'`;
    if (origin)   whereClause += ` AND el.origin ILIKE '%${origin}%'`;
    if (search)   whereClause += ` AND (el.title ILIKE '%${search}%' OR el.description ILIKE '%${search}%')`;

    const listings = await prisma.$queryRaw`
      SELECT el.*,
        s."storeName" as "sellerName", s."storeSlug" as "sellerSlug",
        s.city as "sellerCity", s.rating as "sellerRating",
        ev.status as "verificationStatus",
        ev.certifications as "sellerCertifications"
      FROM export_listings el
      JOIN sellers s ON s.id = el."sellerId"
      LEFT JOIN export_verifications ev ON ev."sellerId" = el."sellerId"
      WHERE el.status = 'ACTIVE'
      ORDER BY el.deals DESC, el.inquiries DESC, el."createdAt" DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;

    // Track view
    if (listings.length) {
      prisma.$queryRaw`
        UPDATE export_listings SET views = views + 1
        WHERE id = ANY(${listings.map(l => l.id)}::text[])
      `.catch(() => {});
    }

    res.json({ success: true, data: listings, page: parseInt(page) });
  } catch (err) { next(err); }
});

router.get('/listings/:id', optionalAuth, async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT el.*,
        s."storeName" as "sellerName", s."storeSlug" as "sellerSlug",
        s.city as "sellerCity", s.rating as "sellerRating",
        s.description as "sellerDescription",
        ev.status as "verificationStatus",
        ev.certifications as "sellerCertifications",
        ev."yearsExporting", ev."annualExportVolume"
      FROM export_listings el
      JOIN sellers s ON s.id = el."sellerId"
      LEFT JOIN export_verifications ev ON ev."sellerId" = el."sellerId"
      WHERE el.id = ${req.params.id}
    `;
    if (!rows.length) throw new AppError('Listing not found.', 404);
    await prisma.$queryRaw`UPDATE export_listings SET views = views + 1 WHERE id = ${req.params.id}`;
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

router.post('/listings', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const {
      productId, title, titleAm, description, category, origin, grade,
      moqQty, moqUnit, pricePerUnit, currency = 'USD', priceTiers = [],
      certifications = [], processingMethod, harvestSeason, availableQty,
      leadTimeDays = 14, incoterms = 'FOB', sampleAvailable = false,
      samplePrice, images = [], videoUrl,
    } = req.body;

    if (!title || !category || !pricePerUnit || !moqQty) {
      throw new AppError('title, category, pricePerUnit and moqQty required.', 400);
    }
    if (!EXPORT_CATEGORIES.includes(category)) {
      throw new AppError(`category must be one of: ${EXPORT_CATEGORIES.join(', ')}`, 400);
    }

    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);

    const id = crypto.randomUUID();
    await prisma.$queryRaw`
      INSERT INTO export_listings (
        id, "sellerId", "productId", title, "titleAm", description, category,
        origin, grade, "moqQty", "moqUnit", "pricePerUnit", currency, "priceTiers",
        certifications, "processingMethod", "harvestSeason", "availableQty",
        "leadTimeDays", incoterms, "sampleAvailable", "samplePrice", images, "videoUrl"
      ) VALUES (
        ${id}, ${seller.id}, ${productId || null}, ${title}, ${titleAm || null},
        ${description || null}, ${category}, ${origin || null}, ${grade || null},
        ${moqQty}, ${moqUnit || 'kg'}, ${pricePerUnit}, ${currency},
        ${JSON.stringify(priceTiers)}::jsonb, ${certifications}::text[],
        ${processingMethod || null}, ${harvestSeason || null}, ${availableQty || null},
        ${leadTimeDays}, ${incoterms}, ${sampleAvailable}, ${samplePrice || null},
        ${images}::text[], ${videoUrl || null}
      )
    `;

    res.status(201).json({ success: true, data: { id } });
  } catch (err) { next(err); }
});

router.patch('/listings/:id', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const rows = await prisma.$queryRaw`
      SELECT id FROM export_listings WHERE id = ${req.params.id} AND "sellerId" = ${seller?.id}
    `;
    if (!rows.length) throw new AppError('Listing not found.', 404);

    const { status, pricePerUnit, availableQty, description } = req.body;
    await prisma.$queryRaw`
      UPDATE export_listings SET
        status = COALESCE(${status || null}, status),
        "pricePerUnit" = COALESCE(${pricePerUnit || null}, "pricePerUnit"),
        "availableQty" = COALESCE(${availableQty || null}, "availableQty"),
        description = COALESCE(${description || null}, description),
        "updatedAt" = NOW()
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/listings/seller/mine', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);
    const listings = await prisma.$queryRaw`
      SELECT * FROM export_listings WHERE "sellerId" = ${seller.id}
      ORDER BY "createdAt" DESC
    `;
    res.json({ success: true, data: listings });
  } catch (err) { next(err); }
});

// ── RFQ (Request for Quote) ───────────────────────────────────────────────────

router.post('/rfq', optionalAuth, async (req, res, next) => {
  try {
    const {
      listingId, sellerId, buyerName, buyerEmail, buyerCountry, buyerCompany,
      message, quantity, unit = 'kg', targetPrice, currency = 'USD',
      deliveryPort, deliveryDate, paymentTerms = 'TT',
    } = req.body;

    if (!buyerName || !buyerEmail || !buyerCountry || !message || !quantity) {
      throw new AppError('buyerName, buyerEmail, buyerCountry, message and quantity required.', 400);
    }

    const rfqId = crypto.randomUUID();
    const buyerId = req.user?.id || rfqId; // guest buyers use rfqId as identifier

    await prisma.$queryRaw`
      INSERT INTO export_rfqs (
        id, "buyerId", "sellerId", "listingId", "buyerName", "buyerEmail",
        "buyerCountry", "buyerCompany", message, quantity, unit, "targetPrice",
        currency, "deliveryPort", "deliveryDate", "paymentTerms"
      ) VALUES (
        ${rfqId}, ${buyerId}, ${sellerId || null}, ${listingId || null},
        ${buyerName}, ${buyerEmail}, ${buyerCountry}, ${buyerCompany || null},
        ${message}, ${quantity}, ${unit}, ${targetPrice || null}, ${currency},
        ${deliveryPort || null}, ${deliveryDate ? new Date(deliveryDate) : null},
        ${paymentTerms}
      )
    `;

    // Update listing inquiry count
    if (listingId) {
      await prisma.$queryRaw`
        UPDATE export_listings SET inquiries = inquiries + 1 WHERE id = ${listingId}
      `;
    }

    // Notify seller
    if (sellerId) {
      const sellerUser = await prisma.seller.findUnique({
        where: { id: sellerId },
        include: { user: { select: { id: true } } },
      });
      if (sellerUser?.user?.id) {
        await createNotification(
          sellerUser.user.id, 'PROMO',
          '📦 New Export Inquiry!',
          `${buyerName} from ${buyerCountry} wants ${quantity}${unit} — check your export dashboard`,
          { rfqId, type: 'EXPORT_RFQ' }
        );
      }
    }

    // Add opening message to chat
    const msgId = crypto.randomUUID();
    await prisma.$queryRaw`
      INSERT INTO export_messages (id, "rfqId", "senderId", "senderRole", "senderName", type, content)
      VALUES (${msgId}, ${rfqId}, ${buyerId}, 'BUYER', ${buyerName}, 'TEXT', ${message})
    `;

    res.status(201).json({ success: true, data: { rfqId } });
  } catch (err) { next(err); }
});

router.get('/rfq', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const seller = await prisma.seller.findUnique({ where: { userId } });

    let rfqs;
    if (seller) {
      // Seller sees their RFQs
      rfqs = await prisma.$queryRaw`
        SELECT er.*, el.title as "listingTitle", el.category, el.images as "listingImages"
        FROM export_rfqs er
        LEFT JOIN export_listings el ON el.id = er."listingId"
        WHERE er."sellerId" = ${seller.id}
        ORDER BY er."createdAt" DESC
        LIMIT 50
      `;
    } else {
      // Buyer sees their own RFQs
      rfqs = await prisma.$queryRaw`
        SELECT er.*, el.title as "listingTitle", el.category
        FROM export_rfqs er
        LEFT JOIN export_listings el ON el.id = er."listingId"
        WHERE er."buyerId" = ${userId}
        ORDER BY er."createdAt" DESC
        LIMIT 50
      `;
    }

    res.json({ success: true, data: rfqs });
  } catch (err) { next(err); }
});

// ── QUOTES — get quotes for an RFQ ───────────────────────────────────────────

router.get('/rfq/:rfqId/quotes', protect, async (req, res, next) => {
  try {
    const quotes = await prisma.$queryRaw`
      SELECT * FROM export_quotes WHERE "rfqId" = ${req.params.rfqId}
      ORDER BY "createdAt" DESC
    `;
    res.json({ success: true, data: quotes });
  } catch (err) { next(err); }
});

// ── QUOTES ────────────────────────────────────────────────────────────────────

router.post('/rfq/:rfqId/quote', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { unitPrice, quantity, unit = 'kg', incoterms = 'FOB', leadTimeDays = 14, validDays = 7, notes } = req.body;
    if (!unitPrice || !quantity) throw new AppError('unitPrice and quantity required.', 400);

    const rfqs = await prisma.$queryRaw`SELECT * FROM export_rfqs WHERE id = ${req.params.rfqId}`;
    if (!rfqs.length) throw new AppError('RFQ not found.', 404);
    const rfq = rfqs[0];

    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const totalAmount = unitPrice * quantity;
    const validUntil = new Date(Date.now() + validDays * 86400000);
    const quoteId = crypto.randomUUID();

    await prisma.$queryRaw`
      INSERT INTO export_quotes (id, "rfqId", "sellerId", "buyerId", "unitPrice", quantity, unit, "totalAmount", currency, incoterms, "leadTimeDays", "validUntil", notes)
      VALUES (${quoteId}, ${req.params.rfqId}, ${seller.id}, ${rfq.buyerId}, ${unitPrice}, ${quantity}, ${unit}, ${totalAmount}, ${rfq.currency || 'USD'}, ${incoterms}, ${leadTimeDays}, ${validUntil}, ${notes || null})
    `;

    // Update RFQ status
    await prisma.$queryRaw`UPDATE export_rfqs SET status = 'QUOTED' WHERE id = ${req.params.rfqId}`;

    // Add quote message to chat
    const msgId = crypto.randomUUID();
    const quoteMsg = `📋 Quote: ${quantity}${unit} @ $${unitPrice}/unit = $${totalAmount.toFixed(2)}\nIncoterms: ${incoterms} | Lead time: ${leadTimeDays} days\nValid until: ${validUntil.toLocaleDateString()}${notes ? '\n' + notes : ''}`;
    await prisma.$queryRaw`
      INSERT INTO export_messages (id, "rfqId", "senderId", "senderRole", "senderName", type, content)
      VALUES (${msgId}, ${req.params.rfqId}, ${seller.id}, 'SELLER', ${seller.storeName}, 'QUOTE', ${quoteMsg})
    `;

    // Notify buyer
    if (rfq.buyerId) {
      await createNotification(
        rfq.buyerId, 'PROMO',
        '💰 Quote Received!',
        `${seller.storeName} sent you a quote: ${quantity}${unit} @ $${unitPrice}/unit`,
        { rfqId: req.params.rfqId, quoteId, type: 'EXPORT_QUOTE' }
      ).catch(() => {});
    }

    res.status(201).json({ success: true, data: { quoteId, totalAmount } });
  } catch (err) { next(err); }
});

router.patch('/quotes/:quoteId/accept', protect, async (req, res, next) => {
  try {
    const quotes = await prisma.$queryRaw`SELECT * FROM export_quotes WHERE id = ${req.params.quoteId}`;
    if (!quotes.length) throw new AppError('Quote not found.', 404);
    const quote = quotes[0];

    await prisma.$queryRaw`UPDATE export_quotes SET status = 'ACCEPTED' WHERE id = ${req.params.quoteId}`;
    await prisma.$queryRaw`UPDATE export_rfqs SET status = 'CONVERTED' WHERE id = ${quote.rfqId}`;

    // Create export order
    const orderId = crypto.randomUUID();
    const depositAmount = quote.totalAmount * 0.3;
    const balanceAmount = quote.totalAmount * 0.7;

    await prisma.$queryRaw`
      INSERT INTO export_orders (id, "rfqId", "quoteId", "buyerId", "sellerId", quantity, unit, "unitPrice", "totalAmount", currency, "depositAmount", "balanceAmount", incoterms)
      VALUES (${orderId}, ${quote.rfqId}, ${quote.id}, ${quote.buyerId}, ${quote.sellerId}, ${quote.quantity}, ${quote.unit}, ${quote.unitPrice}, ${quote.totalAmount}, ${quote.currency}, ${depositAmount}, ${balanceAmount}, ${quote.incoterms})
    `;

    // Notify seller
    await createNotification(
      quote.sellerId, 'PROMO',
      '🎉 Quote Accepted!',
      `Buyer accepted your quote. Export order created — deposit pending.`,
      { orderId, type: 'EXPORT_ORDER_CREATED' }
    ).catch(() => {});

    res.json({ success: true, data: { orderId, depositAmount, balanceAmount } });
  } catch (err) { next(err); }
});

// ── EXPORT CHAT ───────────────────────────────────────────────────────────────

router.get('/rfq/:rfqId/messages', protect, async (req, res, next) => {
  try {
    const messages = await prisma.$queryRaw`
      SELECT * FROM export_messages WHERE "rfqId" = ${req.params.rfqId}
      ORDER BY "createdAt" ASC
    `;
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
});

router.post('/rfq/:rfqId/messages', protect, async (req, res, next) => {
  try {
    const { content, type = 'TEXT', fileUrl, fileName } = req.body;
    if (!content && !fileUrl) throw new AppError('content or fileUrl required.', 400);

    const rfqs = await prisma.$queryRaw`SELECT * FROM export_rfqs WHERE id = ${req.params.rfqId}`;
    if (!rfqs.length) throw new AppError('RFQ not found.', 404);

    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const senderRole = seller ? 'SELLER' : 'BUYER';
    const senderName = seller ? seller.storeName : req.user.name;

    const msgId = crypto.randomUUID();
    await prisma.$queryRaw`
      INSERT INTO export_messages (id, "rfqId", "senderId", "senderRole", "senderName", type, content, "fileUrl", "fileName")
      VALUES (${msgId}, ${req.params.rfqId}, ${req.user.id}, ${senderRole}, ${senderName}, ${type}, ${content || null}, ${fileUrl || null}, ${fileName || null})
    `;

    const msg = { id: msgId, rfqId: req.params.rfqId, senderId: req.user.id, senderRole, senderName, type, content, fileUrl, fileName, createdAt: new Date().toISOString() };
    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
});

// ── EXPORT ORDERS ─────────────────────────────────────────────────────────────

router.get('/orders', protect, async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const orders = seller
      ? await prisma.$queryRaw`SELECT * FROM export_orders WHERE "sellerId" = ${seller.id} ORDER BY "createdAt" DESC`
      : await prisma.$queryRaw`SELECT * FROM export_orders WHERE "buyerId" = ${req.user.id} ORDER BY "createdAt" DESC`;
    res.json({ success: true, data: orders });
  } catch (err) { next(err); }
});

router.patch('/orders/:id/status', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { status, trackingNumber, shippingLine, etd, eta, billOfLadingUrl, certificateOfOriginUrl } = req.body;
    await prisma.$queryRaw`
      UPDATE export_orders SET
        status = COALESCE(${status || null}, status),
        "trackingNumber" = COALESCE(${trackingNumber || null}, "trackingNumber"),
        "shippingLine" = COALESCE(${shippingLine || null}, "shippingLine"),
        "etd" = COALESCE(${etd ? new Date(etd) : null}, "etd"),
        "eta" = COALESCE(${eta ? new Date(eta) : null}, "eta"),
        "billOfLadingUrl" = COALESCE(${billOfLadingUrl || null}, "billOfLadingUrl"),
        "certificateOfOriginUrl" = COALESCE(${certificateOfOriginUrl || null}, "certificateOfOriginUrl"),
        "updatedAt" = NOW()
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── VERIFICATION ──────────────────────────────────────────────────────────────

router.post('/verify', protect, restrictTo('SELLER', 'ADMIN'), async (req, res, next) => {
  try {
    const { businessLicenseUrl, exportLicenseUrl, bankStatementUrl, taxIdNumber, annualExportVolume, yearsExporting, certifications = [] } = req.body;
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller not found.', 404);

    const id = crypto.randomUUID();
    await prisma.$queryRaw`
      INSERT INTO export_verifications (id, "sellerId", "businessLicenseUrl", "exportLicenseUrl", "bankStatementUrl", "taxIdNumber", "annualExportVolume", "yearsExporting", certifications)
      VALUES (${id}, ${seller.id}, ${businessLicenseUrl || null}, ${exportLicenseUrl || null}, ${bankStatementUrl || null}, ${taxIdNumber || null}, ${annualExportVolume || null}, ${yearsExporting || null}, ${certifications}::text[])
      ON CONFLICT ("sellerId") DO UPDATE SET
        "businessLicenseUrl" = EXCLUDED."businessLicenseUrl",
        "exportLicenseUrl" = EXCLUDED."exportLicenseUrl",
        status = 'PENDING'
    `;
    res.status(201).json({ success: true, message: 'Verification submitted. Review within 48 hours.' });
  } catch (err) { next(err); }
});

router.get('/verify/status', protect, async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) return res.json({ success: true, data: null });
    const rows = await prisma.$queryRaw`SELECT * FROM export_verifications WHERE "sellerId" = ${seller.id}`;
    res.json({ success: true, data: rows[0] || null });
  } catch (err) { next(err); }
});

// Admin: approve verification
router.patch('/verify/:sellerId/approve', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    await prisma.$queryRaw`
      UPDATE export_verifications SET status = 'VERIFIED', "verifiedAt" = NOW(), "verifiedBy" = ${req.user.id}
      WHERE "sellerId" = ${req.params.sellerId}
    `;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── CATEGORIES + STATS ────────────────────────────────────────────────────────

router.get('/categories', async (req, res, next) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT category, COUNT(*) as count, AVG("pricePerUnit") as "avgPrice"
      FROM export_listings WHERE status = 'ACTIVE'
      GROUP BY category ORDER BY count DESC
    `;
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

module.exports = router;
