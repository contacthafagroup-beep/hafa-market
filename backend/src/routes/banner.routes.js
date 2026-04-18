const router = require('express').Router();
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { setCache, getCache, delCache, TTL, KEYS } = require('../config/redis');

// ===== PUBLIC: GET ACTIVE BANNERS =====
router.get('/', async (req, res, next) => {
  try {
    const cacheKey = KEYS.banners();
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { sortOrder: 'asc' },
    });

    const result = { success: true, data: banners };
    await setCache(cacheKey, result, TTL.BANNERS);
    res.json(result);
  } catch (err) { next(err); }
});

// ===== ADMIN: CRUD =====
router.use(protect, restrictTo('ADMIN'));

router.get('/all', async (req, res, next) => {
  try {
    const banners = await prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: banners });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const banner = await prisma.banner.create({ data: req.body });
    await delCache(KEYS.banners());
    res.status(201).json({ success: true, data: banner });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const banner = await prisma.banner.update({ where: { id: req.params.id }, data: req.body });
    await delCache(KEYS.banners());
    res.json({ success: true, data: banner });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.banner.delete({ where: { id: req.params.id } });
    await delCache(KEYS.banners());
    res.json({ success: true, message: 'Banner deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
