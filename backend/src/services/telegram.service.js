'use strict';
const logger = require('../config/logger');
let bot = null;

// ── Session store ─────────────────────────────────────────────────────────────
const sessions = new Map();
function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, { step: 'MAIN', data: {}, lang: 'en', cart: [] });
  return sessions.get(chatId);
}
function setSession(chatId, update) {
  sessions.set(chatId, { ...getSession(chatId), ...update });
}

// ── Safe URL helper ───────────────────────────────────────────────────────────
function safeUrl(path) {
  path = path || '';
  const base = process.env.CLIENT_URL || 'https://hafamarket.com';
  if (base.includes('localhost') || base.includes('127.0.0.1')) return 'https://hafamarket.com' + path;
  return base + path;
}

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  en: {
    welcome:    '🌿 *Welcome to Hafa Market!*\n\nAfrica\'s freshest agricultural marketplace.\n\n🔑 Your Chat ID: `{chatId}`\n_Use this to link your account at hafamarket.com_',
    mainMenu:   '🏠 *Main Menu* — What would you like to do?',
    search:     '🔍 Type a product name to search:\n\n_Or type naturally: "cheap tomatoes" or "bulk teff"_',
    trackOrder: '📦 Enter your Order ID (e.g. ABC12345):',
    myOrders:   '📋 *Your Recent Orders*',
    deals:      '🔥 *Today\'s Hot Deals*',
    contact:    '📞 *Contact Us*\n\nPhone: +251 911 000 000\nEmail: support@hafamarket.com',
    notFound:   '❌ Order not found. Please check your Order ID.',
    noOrders:   '📭 No recent orders.\n\nShop now: hafamarket.com',
    language:   '🌐 Choose your language:',
    noResults:  '😕 No products found. Try a different search.',
    aiThinking: '🤖 Thinking...',
    priceAlert: '🔔 *Set Price Alert*\n\nReply with: `product name below ETB amount`\nExample: `honey below 200`',
    alertSet:   '✅ Alert set! I\'ll notify you when the price drops.',
    voiceHint:  '🎤 Send a voice message to search by voice!',
    photoHint:  '📸 Send a product photo to find similar items!',
  },
  am: {
    welcome:    '🌿 *እንኳን ወደ Hafa Market በደህና መጡ!*\n\nየአፍሪካ ትኩስ የግብርና ገበያ።\n\n🔑 የቻት መለያ: `{chatId}`',
    mainMenu:   '🏠 *ዋና ምናሌ* — ምን ማድረግ ይፈልጋሉ?',
    search:     '🔍 የምርት ስም ይፃፉ:',
    trackOrder: '📦 የትዕዛዝ መለያ ቁጥርዎን ያስገቡ:',
    myOrders:   '📋 *የቅርብ ጊዜ ትዕዛዞችዎ*',
    deals:      '🔥 *የዛሬ ቅናሾች*',
    contact:    '📞 *ያግኙን*\n\nስልክ: +251 911 000 000',
    notFound:   '❌ ትዕዛዝ አልተገኘም።',
    noOrders:   '📭 ምንም ትዕዛዝ የለዎትም።',
    language:   '🌐 ቋንቋ ይምረጡ:',
    noResults:  '😕 ምርት አልተገኘም።',
    aiThinking: '🤖 በማሰብ ላይ...',
    priceAlert: '🔔 *የዋጋ ማስጠንቀቂያ*\n\nምሳሌ: `ማር ከ200 ብር በታች`',
    alertSet:   '✅ ማስጠንቀቂያ ተቀናብሯል!',
    voiceHint:  '🎤 ድምጽ መልዕክት ይላኩ!',
    photoHint:  '📸 ፎቶ ይላኩ!',
  },
};
function t(chatId, key, vars) {
  const lang = getSession(chatId).lang || 'en';
  let str = T[lang][key] || T.en[key] || key;
  if (vars) Object.keys(vars).forEach(k => { str = str.replace('{' + k + '}', vars[k]); });
  return str;
}

// ── Keyboards ─────────────────────────────────────────────────────────────────
function mainMenuKeyboard(chatId) {
  const url = safeUrl();
  const isLocal = url.includes('hafamarket.com') && !process.env.CLIENT_URL?.includes('localhost');
  const miniAppBtn = isLocal
    ? [{ text: '🛒 Open Hafa Market', web_app: { url } }]
    : [{ text: '🛒 Open Hafa Market', callback_data: 'shopnow' }];
  return {
    inline_keyboard: [
      miniAppBtn,
      [{ text: '📦 Track Order', callback_data: 'track' }, { text: '📋 My Orders', callback_data: 'orders' }],
      [{ text: '🔥 Deals', callback_data: 'deals' }, { text: '🔍 Search', callback_data: 'search' }],
      [{ text: '🤖 AI Assistant', callback_data: 'ai' }, { text: '🔔 Price Alert', callback_data: 'alert' }],
      [{ text: '🏢 Bulk Orders', callback_data: 'bulk' }, { text: '📞 Contact', callback_data: 'contact' }],
      [{ text: '🌐 Language / ቋንቋ', callback_data: 'lang' }],
    ],
  };
}
function backKeyboard() {
  return { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'back' }]] };
}
function langKeyboard() {
  return { inline_keyboard: [[{ text: '🇬🇧 English', callback_data: 'lang_en' }, { text: '🇪🇹 አማርኛ', callback_data: 'lang_am' }], [{ text: '⬅️ Back', callback_data: 'back' }]] };
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtOrder(order) {
  const emoji = { PENDING:'⏳', CONFIRMED:'✅', PROCESSING:'🔄', SHIPPED:'🚚', OUT_FOR_DELIVERY:'🛵', DELIVERED:'📦', CANCELLED:'❌', REFUNDED:'💰' };
  const items = (order.items || []).slice(0, 3).map(i => '  • ' + i.productName + ' × ' + i.quantity).join('\n');
  return (emoji[order.status] || '📦') + ' *Order #' + order.id.slice(-8).toUpperCase() + '*\n' +
    'Status: *' + order.status.replace(/_/g, ' ') + '*\n' +
    'Total: *ETB ' + (order.total || 0).toFixed(2) + '*\n' +
    'Date: ' + new Date(order.createdAt).toLocaleDateString('en-ET') +
    (items ? '\n\nItems:\n' + items : '');
}
function fmtProduct(p) {
  const org = p.isOrganic ? ' 🌿' : '';
  return '🛒 *' + p.name + '*' + org + '\n' +
    '💰 ETB ' + p.price + '/' + p.unit + '\n' +
    '⭐ ' + (p.rating || 0).toFixed(1) + ' · ' + (p.reviewCount || 0) + ' reviews\n' +
    '📦 Stock: ' + p.stock + ' ' + p.unit;
}

// ── Feature: Search ───────────────────────────────────────────────────────────
async function doSearch(bot, chatId, query, prisma) {
  setSession(chatId, { step: 'MAIN' });
  const products = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { nameAm: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { has: query.toLowerCase() } },
      ],
    },
    take: 6, orderBy: { soldCount: 'desc' },
    include: { category: { select: { emoji: true } } },
  });
  if (!products.length) {
    await bot.sendMessage(chatId, t(chatId, 'noResults'), { reply_markup: mainMenuKeyboard(chatId) });
    return;
  }
  const buttons = products.map(p => ([{
    text: (p.category?.emoji || '🛒') + ' ' + p.name + ' — ETB ' + p.price + '/' + p.unit,
    url: safeUrl('/products/' + p.slug),
  }]));
  buttons.push([{ text: '🔍 See all results for "' + query + '"', url: safeUrl('/products?search=' + encodeURIComponent(query)) }]);
  buttons.push([{ text: '⬅️ Back', callback_data: 'back' }]);
  const text = '🔍 *Results for "' + query + '"*\n\n' + products.map(fmtProduct).join('\n\n---\n\n');
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

// ── Feature: AI Assistant ─────────────────────────────────────────────────────
async function doAI(bot, chatId, question, prisma) {
  setSession(chatId, { step: 'MAIN' });
  const thinking = await bot.sendMessage(chatId, t(chatId, 'aiThinking'));
  try {
    // Get relevant products for context
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' }, take: 20, orderBy: { soldCount: 'desc' },
      select: { name: true, price: true, unit: true, category: { select: { name: true } } },
    });
    const productContext = products.map(p => p.name + ' ETB ' + p.price + '/' + p.unit).join(', ');
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are Hafa Market AI assistant for an Ethiopian agricultural marketplace. Current products: ' + productContext + '. Answer in the user\'s language (English or Amharic). Be concise, max 3 sentences. Include prices when relevant.' },
        { role: 'user', content: question },
      ],
      max_tokens: 300,
    });
    const reply = completion.choices[0].message.content;
    await bot.editMessageText('🤖 *AI Assistant*\n\n' + reply, {
      chat_id: chatId, message_id: thinking.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Search Products', callback_data: 'search' }],
          [{ text: '⬅️ Back', callback_data: 'back' }],
        ],
      },
    });
  } catch (err) {
    await bot.editMessageText('❌ AI unavailable. Try again later.', { chat_id: chatId, message_id: thinking.message_id });
  }
}

// ── Feature: Price Alerts ─────────────────────────────────────────────────────
async function setPriceAlert(bot, chatId, text, prisma) {
  // Parse: "honey below 200" or "ማር ከ200 ብር በታች"
  const match = text.match(/(.+?)\s+(?:below|under|ከ|below)\s+(\d+)/i);
  if (!match) {
    await bot.sendMessage(chatId, '❌ Format: `product name below ETB amount`\nExample: `honey below 200`', { parse_mode: 'Markdown', reply_markup: backKeyboard() });
    return;
  }
  const productName = match[1].trim();
  const targetPrice = parseFloat(match[2]);
  // Find matching product
  const product = await prisma.product.findFirst({
    where: { name: { contains: productName, mode: 'insensitive' }, status: 'ACTIVE' },
  });
  if (!product) {
    await bot.sendMessage(chatId, '❌ Product "' + productName + '" not found. Try a different name.', { reply_markup: backKeyboard() });
    return;
  }
  // Store alert in DB
  await prisma.priceAlert.upsert({
    where: { chatId_productId: { chatId: String(chatId), productId: product.id } },
    update: { targetPrice, isActive: true },
    create: { chatId: String(chatId), productId: product.id, targetPrice, isActive: true },
  }).catch(async () => {
    // Table may not exist yet — store in session as fallback
    const s = getSession(chatId);
    const alerts = s.priceAlerts || [];
    alerts.push({ productId: product.id, productName: product.name, targetPrice });
    setSession(chatId, { priceAlerts: alerts });
  });
  setSession(chatId, { step: 'MAIN' });
  await bot.sendMessage(chatId,
    '✅ *Price Alert Set!*\n\n' +
    '🛒 ' + product.name + '\n' +
    '🎯 Alert when price drops below *ETB ' + targetPrice + '*\n' +
    '📊 Current price: ETB ' + product.price + '/' + product.unit,
    { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard(chatId) }
  );
}

// ── Feature: Voice Search ─────────────────────────────────────────────────────
async function handleVoice(bot, msg, prisma) {
  const chatId = msg.chat.id;
  const processing = await bot.sendMessage(chatId, '🎤 Processing your voice message...');
  try {
    // Download voice file
    const fileId = msg.voice.file_id;
    const fileInfo = await bot.getFile(fileId);
    const fileUrl = 'https://api.telegram.org/file/bot' + process.env.TELEGRAM_BOT_TOKEN + '/' + fileInfo.file_path;
    // Use Groq Whisper for transcription
    const https = require('https');
    const fs = require('fs');
    const path = require('path');
    const tmpFile = path.join(require('os').tmpdir(), 'voice_' + Date.now() + '.ogg');
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tmpFile);
      https.get(fileUrl, res => { res.pipe(file); file.on('finish', () => { file.close(); resolve(); }); }).on('error', reject);
    });
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: 'whisper-large-v3',
      language: 'am', // Amharic first, falls back to auto-detect
    });
    fs.unlinkSync(tmpFile);
    const query = transcription.text.trim();
    await bot.editMessageText('🎤 I heard: *"' + query + '"*\n\nSearching...', {
      chat_id: chatId, message_id: processing.message_id, parse_mode: 'Markdown',
    });
    await doSearch(bot, chatId, query, prisma);
  } catch (err) {
    logger.error('Voice search error:', err.message);
    await bot.editMessageText('❌ Could not process voice. Please type your search instead.', {
      chat_id: chatId, message_id: processing.message_id,
      reply_markup: backKeyboard(),
    });
  }
}

// ── Feature: Photo Search ─────────────────────────────────────────────────────
async function handlePhoto(bot, msg, prisma) {
  const chatId = msg.chat.id;
  const processing = await bot.sendMessage(chatId, '📸 Analyzing your photo...');
  try {
    // Get highest resolution photo
    const photo = msg.photo[msg.photo.length - 1];
    const fileInfo = await bot.getFile(photo.file_id);
    const fileUrl = 'https://api.telegram.org/file/bot' + process.env.TELEGRAM_BOT_TOKEN + '/' + fileInfo.file_path;
    // Use Groq vision to identify the product
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What agricultural product, food, or vegetable is in this image? Reply with ONLY the product name in English, nothing else. If you cannot identify it, reply "unknown".' },
          { type: 'image_url', image_url: { url: fileUrl } },
        ],
      }],
      max_tokens: 20,
    });
    const identified = response.choices[0].message.content.trim().toLowerCase();
    if (identified === 'unknown' || !identified) {
      await bot.editMessageText('😕 Could not identify the product. Please type your search.', {
        chat_id: chatId, message_id: processing.message_id, reply_markup: backKeyboard(),
      });
      return;
    }
    await bot.editMessageText('📸 I see: *' + identified + '*\n\nSearching...', {
      chat_id: chatId, message_id: processing.message_id, parse_mode: 'Markdown',
    });
    await doSearch(bot, chatId, identified, prisma);
  } catch (err) {
    logger.error('Photo search error:', err.message);
    await bot.editMessageText('❌ Could not analyze photo. Please type your search.', {
      chat_id: chatId, message_id: processing.message_id, reply_markup: backKeyboard(),
    });
  }
}

// ── Feature: Seller Storefront deep link ─────────────────────────────────────
async function handleSellerStore(bot, chatId, storeSlug, prisma) {
  const seller = await prisma.seller.findUnique({
    where: { storeSlug },
    include: {
      products: { where: { status: 'ACTIVE' }, take: 5, orderBy: { soldCount: 'desc' } },
      user: { select: { name: true } },
    },
  });
  if (!seller) { await bot.sendMessage(chatId, '❌ Store not found.'); return; }
  const text = '🏪 *' + seller.storeName + '*\n' +
    '📍 ' + (seller.city || 'Ethiopia') + '\n' +
    '⭐ ' + (seller.rating || 0).toFixed(1) + ' · ' + (seller.totalSales || 0) + ' sales\n\n' +
    (seller.description ? seller.description + '\n\n' : '') +
    '*Top Products:*\n' +
    seller.products.map(p => '• ' + p.name + ' — ETB ' + p.price + '/' + p.unit).join('\n');
  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛒 Visit Store', url: safeUrl('/sellers/' + storeSlug) }],
        [{ text: '⬅️ Back', callback_data: 'back' }],
      ],
    },
  });
}

// ── Feature: Deals ────────────────────────────────────────────────────────────
async function handleDeals(bot, chatId, msgId, prisma) {
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', comparePrice: { not: null } },
    orderBy: { soldCount: 'desc' }, take: 6,
    include: { category: { select: { emoji: true } } },
  });
  if (!products.length) {
    const txt = '🔥 No deals right now. Check back soon!';
    if (msgId) await bot.editMessageText(txt, { chat_id: chatId, message_id: msgId, reply_markup: backKeyboard() });
    else await bot.sendMessage(chatId, txt, { reply_markup: backKeyboard() });
    return;
  }
  const lines = products.map(p => {
    const disc = p.comparePrice ? Math.round((1 - p.price / p.comparePrice) * 100) : 0;
    return (p.category?.emoji || '🛒') + ' *' + p.name + '* — ETB ' + p.price + '/' + p.unit + ' ~~ETB ' + p.comparePrice + '~~ *-' + disc + '%*';
  });
  const text = t(chatId, 'deals') + '\n\n' + lines.join('\n\n');
  const kb = {
    inline_keyboard: [
      [{ text: '🛒 Shop All Deals', url: safeUrl('/products?sort=comparePrice') }],
      [{ text: '⬅️ Back', callback_data: 'back' }],
    ],
  };
  if (msgId) await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb });
  else await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb });
}

// ── Feature: My Orders ────────────────────────────────────────────────────────
async function handleMyOrders(bot, chatId, msgId, prisma) {
  const user = await prisma.user.findFirst({ where: { telegramChatId: String(chatId) } }).catch(() => null);
  if (!user) {
    const txt = '🔗 *Link your account first*\n\nVisit ' + safeUrl('/account') + ' to link your Telegram.';
    const kb = { inline_keyboard: [[{ text: '🔗 Link Account', url: safeUrl('/account') }], [{ text: '⬅️ Back', callback_data: 'back' }]] };
    if (msgId) await bot.editMessageText(txt, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb });
    else await bot.sendMessage(chatId, txt, { parse_mode: 'Markdown', reply_markup: kb });
    return;
  }
  const orders = await prisma.order.findMany({
    where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 5,
    include: { items: { select: { productName: true, quantity: true } }, delivery: true },
  });
  if (!orders.length) {
    const txt = t(chatId, 'noOrders');
    const kb = { inline_keyboard: [[{ text: '🛒 Shop Now', url: safeUrl() }], [{ text: '⬅️ Back', callback_data: 'back' }]] };
    if (msgId) await bot.editMessageText(txt, { chat_id: chatId, message_id: msgId, reply_markup: kb });
    else await bot.sendMessage(chatId, txt, { reply_markup: kb });
    return;
  }
  const text = t(chatId, 'myOrders') + '\n\n' + orders.map(fmtOrder).join('\n\n---\n\n');
  const kb = { inline_keyboard: [[{ text: '🛒 Shop More', url: safeUrl() }], [{ text: '⬅️ Back', callback_data: 'back' }]] };
  if (msgId) await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb });
  else await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb });
}

// ── Feature: Track Order ──────────────────────────────────────────────────────
async function handleTrackOrder(bot, chatId, orderId, prisma) {
  const order = await prisma.order.findFirst({
    where: { OR: [{ id: orderId }, { id: { endsWith: orderId.toLowerCase() } }] },
    include: { items: { select: { productName: true, quantity: true } }, delivery: true, address: { select: { city: true } } },
  });
  if (!order) { await bot.sendMessage(chatId, t(chatId, 'notFound'), { reply_markup: backKeyboard() }); return; }
  setSession(chatId, { step: 'MAIN' });
  const buttons = [[{ text: '⬅️ Back', callback_data: 'back' }]];
  if (order.delivery?.trackingCode) buttons.unshift([{ text: '🗺 Track on Map', url: safeUrl('/track/' + order.delivery.trackingCode) }]);
  await bot.sendMessage(chatId, fmtOrder(order), { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

// ── Main handlers ─────────────────────────────────────────────────────────────
async function handleStart(bot, msg, prisma) {
  const chatId = msg.chat.id;
  const text   = msg.text || '';
  setSession(chatId, { step: 'MAIN', data: {} });

  // Deep link: /start store_kwame
  const startParam = text.replace('/start', '').trim();
  if (startParam.startsWith('store_')) {
    await handleSellerStore(bot, chatId, startParam.replace('store_', ''), prisma);
    return;
  }

  const welcome = t(chatId, 'welcome', { chatId }).replace('{chatId}', chatId);
  await bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard(chatId) });
}

async function handleCallback(bot, query, prisma) {
  const chatId = query.message.chat.id;
  const data   = query.data;
  const msgId  = query.message.message_id;
  await bot.answerCallbackQuery(query.id);

  if (data.startsWith('lang_')) {
    setSession(chatId, { lang: data.replace('lang_', ''), step: 'MAIN' });
    await bot.editMessageText(t(chatId, 'mainMenu'), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: mainMenuKeyboard(chatId) });
    return;
  }

  switch (data) {
    case 'back':
      setSession(chatId, { step: 'MAIN' });
      await bot.editMessageText(t(chatId, 'mainMenu'), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: mainMenuKeyboard(chatId) });
      break;
    case 'lang':
      await bot.editMessageText(t(chatId, 'language'), { chat_id: chatId, message_id: msgId, reply_markup: langKeyboard() });
      break;
    case 'track':
      setSession(chatId, { step: 'AWAITING_ORDER_ID' });
      await bot.editMessageText(t(chatId, 'trackOrder'), { chat_id: chatId, message_id: msgId, reply_markup: backKeyboard() });
      break;
    case 'search':
      setSession(chatId, { step: 'AWAITING_SEARCH' });
      await bot.editMessageText(t(chatId, 'search'), { chat_id: chatId, message_id: msgId, reply_markup: backKeyboard() });
      break;
    case 'orders':
      await handleMyOrders(bot, chatId, msgId, prisma);
      break;
    case 'deals':
      await handleDeals(bot, chatId, msgId, prisma);
      break;
    case 'ai':
      setSession(chatId, { step: 'AWAITING_AI' });
      await bot.editMessageText('🤖 *AI Assistant*\n\nAsk me anything about products, prices, or farming!\n\n_Example: "What\'s the best price for teff?" or "ዛሬ ቲማቲም ዋጋ ስንት ነው?"_', {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backKeyboard(),
      });
      break;
    case 'alert':
      setSession(chatId, { step: 'AWAITING_ALERT' });
      await bot.editMessageText(t(chatId, 'priceAlert'), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backKeyboard() });
      break;
    case 'bulk':
      await bot.editMessageText(
        '🏢 *Bulk Orders / ጅምላ ትዕዛዝ*\n\nFor restaurants, hotels, cafes & events.\n\nSubmit your request:',
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '📋 Submit Request', url: safeUrl('/bulk-order') }], [{ text: '⬅️ Back', callback_data: 'back' }]] } }
      );
      break;
    case 'contact':
      await bot.editMessageText(t(chatId, 'contact'), {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🌐 Website', url: safeUrl() }], [{ text: '⬅️ Back', callback_data: 'back' }]] },
      });
      break;
    case 'shopnow':
      await bot.answerCallbackQuery(query.id, { text: 'Visit hafamarket.com to shop! 🛒' });
      break;
    default:
      if (data.startsWith('track:')) await handleTrackOrder(bot, chatId, data.replace('track:', ''), prisma);
      break;
  }
}

async function handleMessage(bot, msg, prisma) {
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();
  if (!text || text.startsWith('/')) return;

  const session = getSession(chatId);

  if (session.step === 'AWAITING_ORDER_ID') { await handleTrackOrder(bot, chatId, text.toUpperCase(), prisma); return; }
  if (session.step === 'AWAITING_SEARCH')   { await doSearch(bot, chatId, text, prisma); return; }
  if (session.step === 'AWAITING_AI')       { await doAI(bot, chatId, text, prisma); return; }
  if (session.step === 'AWAITING_ALERT')    { await setPriceAlert(bot, chatId, text, prisma); return; }

  // Smart natural language — detect intent without explicit command
  const lower = text.toLowerCase();
  if (/track|order|ትዕዛዝ/.test(lower) && /[A-Z0-9]{6,}/i.test(text)) {
    const match = text.match(/[A-Z0-9]{6,}/i);
    if (match) { await handleTrackOrder(bot, chatId, match[0].toUpperCase(), prisma); return; }
  }
  if (/deal|sale|discount|ቅናሽ|offer/.test(lower)) { await handleDeals(bot, chatId, null, prisma); return; }
  if (/bulk|wholesale|ጅምላ|restaurant|hotel/.test(lower)) {
    await bot.sendMessage(chatId, '🏢 *Bulk Orders*\n\nSubmit your bulk request:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '📋 Submit Request', url: safeUrl('/bulk-order') }], [{ text: '⬅️ Back', callback_data: 'back' }]] },
    });
    return;
  }
  // Default: treat as product search
  await doSearch(bot, chatId, text, prisma);
}

// ── Inline mode (type @HafaMarket_bot tomatoes in any chat) ──────────────────
async function handleInlineQuery(bot, query, prisma) {
  const q = query.query.trim();
  if (!q) {
    await bot.answerInlineQuery(query.id, [], { cache_time: 0 });
    return;
  }
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', OR: [{ name: { contains: q, mode: 'insensitive' } }, { nameAm: { contains: q, mode: 'insensitive' } }] },
    take: 8, orderBy: { soldCount: 'desc' },
    include: { category: { select: { emoji: true } } },
  });
  const results = products.map(p => ({
    type: 'article',
    id: p.id,
    title: (p.category?.emoji || '🛒') + ' ' + p.name,
    description: 'ETB ' + p.price + '/' + p.unit + ' · ⭐ ' + (p.rating || 0).toFixed(1),
    thumb_url: p.images?.[0] || undefined,
    input_message_content: {
      message_text: fmtProduct(p) + '\n\n🛒 [Buy on Hafa Market](' + safeUrl('/products/' + p.slug) + ')',
      parse_mode: 'Markdown',
    },
    reply_markup: {
      inline_keyboard: [[{ text: '🛒 Buy Now', url: safeUrl('/products/' + p.slug) }]],
    },
  }));
  await bot.answerInlineQuery(query.id, results, { cache_time: 30 });
}

// ── Broadcast helpers (called from other parts of the app) ────────────────────
async function broadcastDeal(deal) {
  if (!bot || !process.env.TELEGRAM_CHANNEL_ID) return;
  try {
    const text = '🔥 *Flash Deal — Hafa Market*\n\n' +
      (deal.emoji || '🛒') + ' *' + deal.product + '*\n' +
      '💰 ETB ' + deal.price + '/' + deal.unit + '\n' +
      '⏰ Valid for ' + (deal.hours || 24) + ' hours only!\n\n' +
      '🎁 Use code: `' + deal.code + '`';
    await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🛒 Buy Now', url: safeUrl('/products/' + deal.slug) }]] },
    });
    logger.info('Telegram deal broadcast: ' + deal.product);
  } catch (err) { logger.error('Telegram broadcast error:', err.message); }
}

async function sendOrderNotification(telegramChatId, order) {
  if (!bot || !telegramChatId) return;
  try {
    const msgs = {
      CONFIRMED:        '✅ Your order has been confirmed!',
      SHIPPED:          '🚚 Your order is on its way!',
      OUT_FOR_DELIVERY: '🛵 Your order is out for delivery!',
      DELIVERED:        '📦 Your order has been delivered! Please rate your experience.',
      CANCELLED:        '❌ Your order has been cancelled.',
    };
    const msg = msgs[order.status];
    if (!msg) return;
    const buttons = [[{ text: '📦 Track Order', url: order.delivery?.trackingCode ? safeUrl('/track/' + order.delivery.trackingCode) : safeUrl('/account/orders/' + order.id) }]];
    if (order.status === 'DELIVERED') buttons.push([{ text: '⭐ Rate Experience', url: safeUrl('/account/orders/' + order.id) }]);
    await bot.sendMessage(telegramChatId,
      msg + '\n\n*Order #' + order.id.slice(-8).toUpperCase() + '*\nTotal: ETB ' + (order.total || 0).toFixed(2),
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
    );
  } catch (err) { logger.error('Telegram order notification error:', err.message); }
}

async function sendSellerNotification(sellerTelegramChatId, order) {
  if (!bot || !sellerTelegramChatId) return;
  try {
    const items = (order.items || []).map(i => '• ' + i.productName + ' × ' + i.quantity + ' ' + (i.unit || '')).join('\n');
    const text = '🛒 *New Order Received!*\n\n' +
      'Order #' + order.id.slice(-8).toUpperCase() + '\n' +
      'Total: ETB ' + (order.total || 0).toFixed(2) + '\n' +
      'Payment: ' + (order.payment?.method || 'N/A').replace(/_/g, ' ') + '\n\n' +
      '*Items:*\n' + items;
    await bot.sendMessage(sellerTelegramChatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Accept Order', url: safeUrl('/dashboard/orders') }, { text: '❌ Reject', url: safeUrl('/dashboard/orders') }],
          [{ text: '📋 View Dashboard', url: safeUrl('/dashboard') }],
        ],
      },
    });
  } catch (err) { logger.error('Telegram seller notification error:', err.message); }
}

async function checkPriceAlerts(prisma) {
  if (!bot) return;
  try {
    const alerts = await prisma.priceAlert.findMany({
      where: { isActive: true },
      include: { product: { select: { id: true, name: true, price: true, unit: true, slug: true } } },
    }).catch(() => []);
    for (const alert of alerts) {
      if (alert.product.price <= alert.targetPrice) {
        await bot.sendMessage(alert.chatId,
          '🔔 *Price Alert!*\n\n' +
          '🛒 ' + alert.product.name + '\n' +
          '💰 Price dropped to *ETB ' + alert.product.price + '/' + alert.product.unit + '*\n' +
          '🎯 Your target: ETB ' + alert.targetPrice,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🛒 Buy Now', url: safeUrl('/products/' + alert.product.slug) }]] },
          }
        ).catch(() => {});
        await prisma.priceAlert.update({ where: { id: alert.id }, data: { isActive: false } }).catch(() => {});
      }
    }
  } catch (err) { logger.error('Price alert check error:', err.message); }
}

// ── Initialize bot ────────────────────────────────────────────────────────────
function initTelegramBot(prisma) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'your_bot_token_here') {
    logger.warn('Telegram bot token not set — bot disabled');
    return null;
  }
  try {
    const TelegramBot = require('node-telegram-bot-api');
    bot = new TelegramBot(token, { polling: true });

    bot.setMyCommands([
      { command: 'start',   description: 'Main Menu' },
      { command: 'search',  description: 'Search products' },
      { command: 'track',   description: 'Track an order' },
      { command: 'orders',  description: 'My recent orders' },
      { command: 'deals',   description: 'Today\'s hot deals' },
      { command: 'ai',      description: 'AI Assistant' },
      { command: 'alert',   description: 'Set price alert' },
      { command: 'bulk',    description: 'Bulk order request' },
      { command: 'lang',    description: 'Change language / ቋንቋ ቀይር' },
    ]);

    // Enable inline mode
    bot.on('inline_query', q => handleInlineQuery(bot, q, prisma));

    // Commands
    bot.onText(/\/start(.*)/, (msg) => handleStart(bot, msg, prisma));
    bot.onText(/\/search(?:\s+(.+))?/, async (msg, match) => {
      if (match[1]) await doSearch(bot, msg.chat.id, match[1].trim(), prisma);
      else { setSession(msg.chat.id, { step: 'AWAITING_SEARCH' }); await bot.sendMessage(msg.chat.id, t(msg.chat.id, 'search'), { reply_markup: backKeyboard() }); }
    });
    bot.onText(/\/track(?:\s+(.+))?/, async (msg, match) => {
      if (match[1]) await handleTrackOrder(bot, msg.chat.id, match[1].trim().toUpperCase(), prisma);
      else { setSession(msg.chat.id, { step: 'AWAITING_ORDER_ID' }); await bot.sendMessage(msg.chat.id, t(msg.chat.id, 'trackOrder'), { reply_markup: backKeyboard() }); }
    });
    bot.onText(/\/orders/, async (msg) => { const s = await bot.sendMessage(msg.chat.id, '⏳'); await handleMyOrders(bot, msg.chat.id, s.message_id, prisma); });
    bot.onText(/\/deals/,  async (msg) => { const s = await bot.sendMessage(msg.chat.id, '⏳'); await handleDeals(bot, msg.chat.id, s.message_id, prisma); });
    bot.onText(/\/ai/,     async (msg) => { setSession(msg.chat.id, { step: 'AWAITING_AI' }); await bot.sendMessage(msg.chat.id, '🤖 Ask me anything about products or prices:', { reply_markup: backKeyboard() }); });
    bot.onText(/\/alert/,  async (msg) => { setSession(msg.chat.id, { step: 'AWAITING_ALERT' }); await bot.sendMessage(msg.chat.id, t(msg.chat.id, 'priceAlert'), { parse_mode: 'Markdown', reply_markup: backKeyboard() }); });
    bot.onText(/\/bulk/,   async (msg) => { await bot.sendMessage(msg.chat.id, '🏢 *Bulk Orders*\n\nSubmit your request:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📋 Submit', url: safeUrl('/bulk-order') }]] } }); });
    bot.onText(/\/lang/,   async (msg) => { await bot.sendMessage(msg.chat.id, t(msg.chat.id, 'language'), { reply_markup: langKeyboard() }); });

    // Callback queries
    bot.on('callback_query', q => handleCallback(bot, q, prisma));

    // Text messages (natural language)
    bot.on('message', msg => { if (msg.text && !msg.text.startsWith('/')) handleMessage(bot, msg, prisma); });

    // Voice messages → voice search
    bot.on('message', msg => { if (msg.voice) handleVoice(bot, msg, prisma); });

    // Photo messages → photo search
    bot.on('message', msg => { if (msg.photo) handlePhoto(bot, msg, prisma); });

    // Error handling
    bot.on('polling_error', err => {
      if (err.message?.includes('409')) {
        logger.warn('Telegram 409 — stopping and restarting polling in 5s');
        bot.stopPolling().then(() => setTimeout(() => bot.startPolling().catch(() => {}), 5000)).catch(() => {});
      } else {
        logger.error('Telegram polling error:', err.message);
      }
    });

    // Price alert checker — every 30 minutes
    setInterval(() => checkPriceAlerts(prisma), 30 * 60 * 1000);

    logger.info('🤖 Telegram bot started — @HafaMarket_bot');
    return bot;
  } catch (err) {
    logger.error('Failed to initialize Telegram bot:', err.message);
    return null;
  }
}

module.exports = { initTelegramBot, broadcastDeal, sendOrderNotification, sendSellerNotification, checkPriceAlerts, getBot: () => bot };
