const router = require('express').Router();
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.get('/', async (req, res, next) => {
  try {
    const { page=1, limit=10, category } = req.query;
    const where = { isPublished: true };
    if (category) where.category = category;
    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({ where, skip:(parseInt(page)-1)*parseInt(limit), take:parseInt(limit),
        orderBy:{ publishedAt:'desc' },
        select:{ id:true, title:true, titleAm:true, slug:true, excerpt:true, coverImage:true, category:true, tags:true, publishedAt:true, viewCount:true } }),
      prisma.blogPost.count({ where }),
    ]);
    res.json({ success:true, data:posts, pagination:{ page:parseInt(page), limit:parseInt(limit), total } });
  } catch(err) { next(err); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { slug: req.params.slug } });
    if (!post || !post.isPublished) return res.status(404).json({ success:false, message:'Post not found.' });
    await prisma.blogPost.update({ where:{ id:post.id }, data:{ viewCount:{ increment:1 } } });
    res.json({ success:true, data:post });
  } catch(err) { next(err); }
});

router.post('/', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { title, titleAm, content, excerpt, coverImage, category, tags, isPublished } = req.body;
    const slug = `${title.toLowerCase().replace(/\s+/g,'-')}-${Date.now()}`;
    const post = await prisma.blogPost.create({
      data: { title, titleAm, slug, content, excerpt, coverImage, category, tags:tags||[],
              authorId: req.user.id, isPublished: !!isPublished,
              publishedAt: isPublished ? new Date() : null },
    });
    res.status(201).json({ success:true, data:post });
  } catch(err) { next(err); }
});

module.exports = router;

router.patch('/:id', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { title, titleAm, content, excerpt, coverImage, category, tags, isPublished } = req.body;
    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(titleAm !== undefined && { titleAm }),
        ...(content !== undefined && { content }),
        ...(excerpt !== undefined && { excerpt }),
        ...(coverImage !== undefined && { coverImage }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags }),
        ...(isPublished !== undefined && {
          isPublished,
          publishedAt: isPublished ? new Date() : null,
        }),
      },
    });
    res.json({ success: true, data: post });
  } catch(err) { next(err); }
});

router.delete('/:id', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Post deleted.' });
  } catch(err) { next(err); }
});
