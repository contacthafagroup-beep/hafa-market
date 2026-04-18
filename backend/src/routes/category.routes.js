const router = require('express').Router();
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { setCache, getCache, delCache, invalidateCategory, TTL, KEYS } = require('../config/redis');

router.get('/', async (req, res, next) => {
  try {
    const cacheKey = KEYS.categories();
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    const result = { success: true, data: categories };
    await setCache(cacheKey, result, TTL.CATEGORIES);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const cat = await prisma.category.create({ data: req.body });
    await invalidateCategory();
    res.status(201).json({ success: true, data: cat });
  } catch (err) { next(err); }
});

router.patch('/:id', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const cat = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    await invalidateCategory();
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
});

router.delete('/:id', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    await invalidateCategory();
    res.json({ success: true, message: 'Category deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;
