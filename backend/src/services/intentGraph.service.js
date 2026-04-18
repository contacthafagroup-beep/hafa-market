'use strict';
/**
 * SELF-LEARNING ETHIOPIAN INTENT GRAPH
 * =====================================
 * A 3-layer system that understands ANY Amharic, Afaan Oromo, or mixed query.
 *
 * Layer 1 - SEED (instant, ~0ms):
 *   ~80 hardcoded entries for the most common Ethiopian terms.
 *   Never needs DB or AI. Always available.
 *
 * Layer 2 - DATABASE (fast, ~5ms):
 *   Entries that Groq AI has already learned and saved.
 *   Grows automatically. After 1000 users, knows thousands of phrases.
 *
 * Layer 3 - GROQ AI (unlimited, ~300ms):
 *   Handles anything new. Understands full cultural context.
 *   Saves result to DB so next user gets Layer 2 speed.
 *
 * Result: The graph starts with 80 entries and grows to UNLIMITED
 * as real users search in Amharic, Oromo, Tigrinya, or mixed language.
 */

const prisma = require('../config/prisma');
const { setCache, getCache, getRedis, isAvailable } = require('../config/redis');
const logger = require('../config/logger');

// ============================================================
// SEED DATA — hardcoded fast-path for the most common queries
// ============================================================
const SEED = {
  // AMHARIC HOLIDAYS
  'ፋሲካ':       { terms: ['eggs','lamb','injera','teff','honey','butter','meat'], intent: 'holiday', boost: 15, language: 'am' },
  'fasika':     { terms: ['eggs','lamb','injera','teff','honey','butter','meat'], intent: 'holiday', boost: 15, language: 'en' },
  'ጥምቀት':      { terms: ['fish','injera','teff','vegetables','lentils'], intent: 'holiday', boost: 12, language: 'am' },
  'timkat':     { terms: ['fish','injera','teff','vegetables','lentils'], intent: 'holiday', boost: 12, language: 'en' },
  'ገና':         { terms: ['chicken','doro','injera','teff','honey','butter','spices'], intent: 'holiday', boost: 15, language: 'am' },
  'gena':       { terms: ['chicken','doro','injera','teff','honey','butter','spices'], intent: 'holiday', boost: 15, language: 'en' },
  'ዓዲስ ዓመት':  { terms: ['teff','honey','butter','spices','coffee','injera'], intent: 'holiday', boost: 12, language: 'am' },
  'enkutatash': { terms: ['teff','honey','butter','spices','coffee','injera'], intent: 'holiday', boost: 12, language: 'en' },
  'ሠርግ':       { terms: ['teff','meat','chicken','butter','honey','spices','oil','onions'], intent: 'event', boost: 18, language: 'am' },
  'wedding':    { terms: ['teff','meat','chicken','butter','honey','spices','oil','onions'], intent: 'event', boost: 18, language: 'en' },
  'ቀብር':       { terms: ['teff','injera','lentils','vegetables','oil'], intent: 'event', boost: 10, language: 'am' },
  'ጾም':        { terms: ['lentils','chickpeas','beans','vegetables','oil','fish'], intent: 'fasting', boost: 14, language: 'am' },
  'fasting':    { terms: ['lentils','chickpeas','beans','vegetables','oil','fish'], intent: 'fasting', boost: 14, language: 'en' },
  'tsom':       { terms: ['lentils','chickpeas','beans','vegetables','oil','fish'], intent: 'fasting', boost: 14, language: 'en' },
  'ጾም ፈረሰ':   { terms: ['meat','chicken','eggs','butter','milk'], intent: 'post_fasting', boost: 16, language: 'am' },
  // AMHARIC RECIPES
  'ዶሮ ወጥ':    { terms: ['chicken','onions','spices','butter','eggs','berbere'], intent: 'recipe', boost: 10, language: 'am' },
  'doro wot':  { terms: ['chicken','onions','spices','butter','eggs','berbere'], intent: 'recipe', boost: 10, language: 'en' },
  'ክትፎ':      { terms: ['beef','butter','spices','onions','berbere'], intent: 'recipe', boost: 10, language: 'am' },
  'kitfo':     { terms: ['beef','butter','spices','onions','berbere'], intent: 'recipe', boost: 10, language: 'en' },
  'ሽሮ':       { terms: ['chickpea flour','shiro','onions','oil','spices'], intent: 'recipe', boost: 10, language: 'am' },
  'shiro':     { terms: ['chickpea flour','shiro','onions','oil','spices'], intent: 'recipe', boost: 10, language: 'en' },
  'ጥብስ':      { terms: ['meat','beef','lamb','onions','peppers','spices'], intent: 'recipe', boost: 8, language: 'am' },
  'tibs':      { terms: ['meat','beef','lamb','onions','peppers','spices'], intent: 'recipe', boost: 8, language: 'en' },
  'ፍርፍር':     { terms: ['injera','teff','meat','vegetables'], intent: 'recipe', boost: 8, language: 'am' },
  'firfir':    { terms: ['injera','teff','meat','vegetables'], intent: 'recipe', boost: 8, language: 'en' },
  'ቅቤ':       { terms: ['butter','spiced butter','niter kibbeh'], intent: 'ingredient', boost: 8, language: 'am' },
  'ቡና':       { terms: ['coffee','roasted coffee','raw coffee'], intent: 'coffee', boost: 8, language: 'am' },
  'ቡና ቤት':   { terms: ['coffee','roasted coffee','cardamom','sugar'], intent: 'coffee', boost: 10, language: 'am' },
  // AMHARIC SEASONAL
  'ክረምት':    { terms: ['maize','sorghum','vegetables','greens'], intent: 'seasonal', boost: 8, language: 'am' },
  'kiremt':   { terms: ['maize','sorghum','vegetables','greens'], intent: 'seasonal', boost: 8, language: 'en' },
  'ምርት':     { terms: ['harvest','teff','wheat','maize','sorghum'], intent: 'harvest', boost: 8, language: 'am' },
  // AFAAN OROMO HOLIDAYS
  'irreechaa': { terms: ['honey','teff','milk','butter','coffee','traditional foods'], intent: 'holiday', boost: 18, language: 'om' },
  'irrecha':   { terms: ['honey','teff','milk','butter','coffee','traditional foods'], intent: 'holiday', boost: 18, language: 'om' },
  'ayyaana':   { terms: ['traditional foods','honey','coffee','teff','butter'], intent: 'holiday', boost: 12, language: 'om' },
  'birraa':    { terms: ['harvest','teff','wheat','maize','sorghum'], intent: 'harvest', boost: 10, language: 'om' },
  'ganna':     { terms: ['maize','sorghum','vegetables','greens'], intent: 'seasonal', boost: 8, language: 'om' },
  'arfaasaa':  { terms: ['fresh produce','vegetables','fruits'], intent: 'seasonal', boost: 8, language: 'om' },
  'bona':      { terms: ['dried goods','grains','legumes','preserved'], intent: 'seasonal', boost: 6, language: 'om' },
  // AFAAN OROMO FOOD
  'foon':      { terms: ['meat','beef','lamb','goat'], intent: 'meat', boost: 8, language: 'om' },
  'lukkuu':    { terms: ['chicken','poultry','eggs'], intent: 'poultry', boost: 8, language: 'om' },
  'hanqaaquu': { terms: ['eggs','poultry'], intent: 'poultry', boost: 8, language: 'om' },
  'aannan':    { terms: ['milk','dairy','butter'], intent: 'dairy', boost: 8, language: 'om' },
  'dhadhaa':   { terms: ['butter','ghee','niter kibbeh'], intent: 'dairy', boost: 8, language: 'om' },
  'damma':     { terms: ['honey','pure honey','raw honey'], intent: 'specialty', boost: 10, language: 'om' },
  'mudhii':    { terms: ['honey','pure honey'], intent: 'specialty', boost: 10, language: 'om' },
  'xaafii':    { terms: ['teff','injera'], intent: 'grain', boost: 8, language: 'om' },
  'garbuu':    { terms: ['barley','grains'], intent: 'grain', boost: 8, language: 'om' },
  'masaraa':   { terms: ['maize','corn','grains'], intent: 'grain', boost: 8, language: 'om' },
  'qamadii':   { terms: ['wheat','flour','grains'], intent: 'grain', boost: 8, language: 'om' },
  'boqqolloo': { terms: ['sorghum','grains'], intent: 'grain', boost: 8, language: 'om' },
  'baaqelaa':  { terms: ['beans','legumes','lentils'], intent: 'legumes', boost: 8, language: 'om' },
  'atara':     { terms: ['chickpeas','legumes','shiro'], intent: 'legumes', boost: 8, language: 'om' },
  'dinnicha':  { terms: ['potato','potatoes'], intent: 'vegetable', boost: 6, language: 'om' },
  'aanmoo':    { terms: ['onion','onions'], intent: 'vegetable', boost: 6, language: 'om' },
  'toomaatoo': { terms: ['tomato','tomatoes'], intent: 'vegetable', boost: 6, language: 'om' },
  'qocaa':     { terms: ['cabbage','vegetables'], intent: 'vegetable', boost: 6, language: 'om' },
  'qaaroota':  { terms: ['carrot','carrots'], intent: 'vegetable', boost: 6, language: 'om' },
  'marqaa':    { terms: ['porridge','oats','grains','teff'], intent: 'recipe', boost: 8, language: 'om' },
  'buddeena':  { terms: ['bread','injera','teff','wheat'], intent: 'recipe', boost: 8, language: 'om' },
  'buna':      { terms: ['coffee','roasted coffee','raw coffee'], intent: 'coffee', boost: 8, language: 'om' },
  // BUSINESS INTENTS
  'ምግብ ቤት':  { terms: ['bulk','wholesale','vegetables','meat','oil','onions','tomatoes'], intent: 'bulk', boost: 15, language: 'am' },
  'ሆቴል':     { terms: ['bulk','wholesale','vegetables','meat','oil','onions','tomatoes'], intent: 'bulk', boost: 15, language: 'am' },
  'ጅምላ':     { terms: ['bulk','wholesale','large quantity'], intent: 'bulk', boost: 12, language: 'am' },
  'ርካሽ':     { terms: ['affordable','cheap','budget'], intent: 'cheap', boost: 8, language: 'am' },
  'ትኩስ':     { terms: ['fresh','organic','just harvested'], intent: 'fresh', boost: 10, language: 'am' },
  'ኦርጋኒክ':  { terms: ['organic','natural','chemical free'], intent: 'organic', boost: 10, language: 'am' },
};

// ============================================================
// LANGUAGE DETECTION
// ============================================================
function detectLanguage(query) {
  if (/[\u1200-\u137F]/.test(query)) return 'am'; // Ethiopic script = Amharic/Tigrinya
  if (/\b(xaa|qaa|dha|gaa|boo|irr|arr|abb|uff|iss|foon|lukkuu|aannan|damma|garbuu|masaraa|qamadii|boqqolloo|baaqelaa|dinnicha|aanmoo|toomaatoo|qocaa|qaaroota|marqaa|buddeena|birraa|arfaasaa|irreechaa|ayyaana)\b/i.test(query)) return 'om';
  return 'en';
}

// ============================================================
// LAYER 1: SEED CHECK (instant)
// ============================================================
function checkSeed(query) {
  const lower = query.toLowerCase().trim();
  const words = lower.split(/\s+/);
  for (const phrase of [lower, ...words]) {
    if (SEED[phrase]) return { ...SEED[phrase], source: 'seed' };
  }
  for (const [key, value] of Object.entries(SEED)) {
    if (lower.includes(key) || key.includes(lower)) return { ...value, source: 'seed' };
  }
  return null;
}

// ============================================================
// LAYER 2: DATABASE CHECK (learned entries)
// ============================================================
async function checkDatabase(query) {
  const lower = query.toLowerCase().trim();
  const cacheKey = `intent:db:${lower.slice(0, 60)}`;
  const cached = await getCache(cacheKey);
  if (cached !== undefined && cached !== null) return cached;
  if (cached === false) return null;

  try {
    let entry = await prisma.intentGraphEntry.findFirst({
      where: { query: lower, isActive: true },
    });

    if (!entry) {
      const words = lower.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        entry = await prisma.intentGraphEntry.findFirst({
          where: { isActive: true, OR: words.map(w => ({ query: { contains: w, mode: 'insensitive' } })) },
          orderBy: { useCount: 'desc' },
        });
      }
    }

    if (entry) {
      prisma.intentGraphEntry.update({ where: { id: entry.id }, data: { useCount: { increment: 1 } } }).catch(() => {});
      const result = { terms: entry.terms, intent: entry.intent, boost: entry.boost, source: 'db', confidence: entry.confidence };
      await setCache(cacheKey, result, 3600);
      return result;
    }

    await setCache(cacheKey, false, 300);
    return null;
  } catch (err) {
    logger.debug('Intent DB lookup failed:', err.message);
    return null;
  }
}

// ============================================================
// LAYER 3: GROQ AI — unlimited, learns and saves to DB
// ============================================================
async function learnWithAI(query) {
  const language = detectLanguage(query);
  const cacheKey = `intent:ai:${query.toLowerCase().slice(0, 60)}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const langHint = language === 'am' ? 'Amharic (Ethiopian)' :
                     language === 'om' ? 'Afaan Oromo (Ethiopian Oromo)' : 'English';

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'system',
        content: `You are an expert in Ethiopian food culture, agriculture, and commerce.
You deeply understand Amharic (አማርኛ), Afaan Oromo, Tigrinya, and all Ethiopian cultural contexts.
You know Ethiopian Orthodox fasting rules, Oromo festivals, traditional recipes, seasonal agriculture, and market terminology.

Given a search query from an Ethiopian agricultural marketplace, extract:
- "terms": array of 3-7 specific English product names (be culturally accurate)
- "intent": one of: holiday, recipe, bulk, fasting, post_fasting, seasonal, harvest, fresh, organic, cheap, event, coffee, dairy, meat, grain, vegetable, legumes, specialty, snack, ingredient, farming, meal
- "boost": 6-20 (importance of this intent for ranking)
- "confidence": 0.0-1.0

Cultural rules:
- During fasting (ጾም/tsom): NO meat, chicken, eggs, butter, milk — only plant-based
- Irreechaa (Oromo): honey, teff, milk, butter, coffee are traditional
- Ethiopian weddings (ሠርግ): large quantities of teff, meat, chicken, spices
- Coffee ceremony (ቡና ቤት): coffee, cardamom, incense, sugar
- Post-fasting (ጾም ፈረሰ): meat, eggs, butter, milk — celebration foods

Respond ONLY with valid JSON. No explanation.`,
      }, {
        role: 'user',
        content: `Query: "${query}" (Language hint: ${langHint})`,
      }],
      max_tokens: 150,
      temperature: 0.1,
    });

    const text = completion.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.terms || !parsed.terms.length || !parsed.intent) return null;

    const result = {
      terms: parsed.terms.slice(0, 7),
      intent: parsed.intent,
      boost: Math.min(Math.max(parseInt(parsed.boost) || 8, 6), 20),
      confidence: parseFloat(parsed.confidence) || 0.8,
      source: 'ai',
    };

    // SAVE TO DATABASE — this is how the graph grows to unlimited
    prisma.intentGraphEntry.upsert({
      where: { query: query.toLowerCase().trim() },
      update: { terms: result.terms, intent: result.intent, boost: result.boost, confidence: result.confidence, useCount: { increment: 1 }, updatedAt: new Date() },
      create: { query: query.toLowerCase().trim(), language, terms: result.terms, intent: result.intent, boost: result.boost, confidence: result.confidence, source: 'ai', useCount: 1 },
    }).catch(err => logger.debug('Intent save failed:', err.message));

    await setCache(cacheKey, result, 7200);
    return result;

  } catch (err) {
    logger.debug('AI intent learning failed:', err.message);
    return null;
  }
}

// ============================================================
// MAIN RESOLVER — tries all 3 layers
// ============================================================
async function resolveIntent(query) {
  if (!query || query.trim().length < 2) return null;

  // Layer 1: Seed (instant, no I/O)
  const seed = checkSeed(query);
  if (seed) return seed;

  // Layer 2: Database (fast, already learned)
  const db = await checkDatabase(query);
  if (db) return db;

  // Layer 3: AI (unlimited — only for non-trivial queries)
  const language = detectLanguage(query);
  const isNonEnglish = language !== 'en';
  const isMultiWord = query.trim().split(/\s+/).length >= 2;
  if (isNonEnglish || isMultiWord) {
    return await learnWithAI(query);
  }

  return null;
}

// ============================================================
// ADMIN: Get graph stats
// ============================================================
async function getGraphStats() {
  try {
    const [total, bySource, byLanguage, topUsed] = await Promise.all([
      prisma.intentGraphEntry.count({ where: { isActive: true } }),
      prisma.intentGraphEntry.groupBy({ by: ['source'], _count: { source: true }, where: { isActive: true } }),
      prisma.intentGraphEntry.groupBy({ by: ['language'], _count: { language: true }, where: { isActive: true } }),
      prisma.intentGraphEntry.findMany({ where: { isActive: true }, orderBy: { useCount: 'desc' }, take: 10, select: { query: true, intent: true, useCount: true, source: true, language: true } }),
    ]);

    return {
      totalEntries: total + Object.keys(SEED).length,
      seedEntries: Object.keys(SEED).length,
      learnedEntries: total,
      bySource: bySource.reduce((acc, s) => { acc[s.source] = s._count.source; return acc; }, {}),
      byLanguage: byLanguage.reduce((acc, l) => { acc[l.language] = l._count.language; return acc; }, {}),
      topUsed,
    };
  } catch {
    return { totalEntries: Object.keys(SEED).length, seedEntries: Object.keys(SEED).length, learnedEntries: 0 };
  }
}

// ============================================================
// ADMIN: Manually add/edit an entry
// ============================================================
async function addEntry(query, terms, intent, boost, language) {
  return prisma.intentGraphEntry.upsert({
    where: { query: query.toLowerCase().trim() },
    update: { terms, intent, boost, language, source: 'admin', isActive: true, updatedAt: new Date() },
    create: { query: query.toLowerCase().trim(), language: language || detectLanguage(query), terms, intent, boost: boost || 8, source: 'admin' },
  });
}

module.exports = { resolveIntent, getGraphStats, addEntry, detectLanguage, SEED };
