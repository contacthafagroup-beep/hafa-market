const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { setCache, getCache, delCachePattern, invalidateProduct, TTL, KEYS } = require('../config/redis');
const { indexProduct, deleteProduct: deleteFromTypesense } = require('../config/typesense');

exports.getProducts = async (req, res, next) => {
  try {
    const { page=1, limit=20, category, search, minPrice, maxPrice,
            sort='createdAt', order='desc', isOrganic, isFeatured, sellerId, minRating } = req.query;
    const skip = (parseInt(page)-1) * parseInt(limit);
    const where = { status: 'ACTIVE' };
    if (category) where.category = { slug: category };
    if (sellerId) where.sellerId = sellerId;
    if (isOrganic === 'true') where.isOrganic = true;
    if (isFeatured === 'true') where.isFeatured = true;
    if (minRating) where.rating = { gte: parseFloat(minRating) };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameAm: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }
    const cacheKey = KEYS.products(JSON.stringify({where,skip,limit,sort,order}));
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: parseInt(limit), orderBy: { [sort]: order },
        include: {
          seller: { select: { id:true, storeName:true, storeSlug:true, rating:true } },
          category: { select: { id:true, name:true, slug:true, emoji:true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const result = { success:true, data:products,
      pagination: { page:parseInt(page), limit:parseInt(limit), total, pages:Math.ceil(total/parseInt(limit)) } };
    await setCache(cacheKey, result, TTL.PRODUCTS_LIST);
    res.json(result);
  } catch(err) { next(err); }
};

exports.getProduct = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const cached = await getCache(KEYS.product(slug));
    if (cached) return res.json(cached);

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        seller: { select: { id:true, storeName:true, storeSlug:true, logo:true, rating:true, totalSales:true, city:true } },
        category: { select: { id:true, name:true, nameAm:true, slug:true, emoji:true } },
        reviews: { take:10, orderBy:{ createdAt:'desc' },
          include: { user: { select: { id:true, name:true, avatar:true } } } },
      },
    });
    if (!product) throw new AppError('Product not found.', 404);
    prisma.product.update({ where:{ id:product.id }, data:{ viewCount:{ increment:1 } } }).catch(()=>{});
    const result = { success:true, data:product };
    await setCache(KEYS.product(slug), result, TTL.PRODUCT);
    res.json(result);
  } catch(err) { next(err); }
};

exports.createProduct = async (req, res, next) => {
  try {
    const seller = await prisma.seller.findUnique({ where:{ userId:req.user.id } });
    if (!seller) throw new AppError('Seller account not found.', 404);
    if (seller.status !== 'VERIFIED') throw new AppError('Seller account not verified yet.', 403);
    const { name, nameAm, nameOm, categoryId, description, price, comparePrice,
            unit, minOrder, stock, images, tags, isOrganic, weight, origin } = req.body;
    const slug = `${name.toLowerCase().replace(/\s+/g,'-')}-${Date.now()}`;
    const product = await prisma.product.create({
      data: { sellerId:seller.id, categoryId, name, nameAm, nameOm, slug, description,
              price:parseFloat(price), comparePrice:comparePrice?parseFloat(comparePrice):null,
              unit:unit||'kg', minOrder:parseFloat(minOrder||1), stock:parseFloat(stock||0),
              images:images||[], tags:tags||[], isOrganic:!!isOrganic,
              weight:weight?parseFloat(weight):null, origin },
    });
    await delCachePattern('products:*');
    // Index in Typesense for fast search
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true, emoji: true } }).catch(() => null);
    indexProduct(product, category, seller).catch(() => {});
    res.status(201).json({ success:true, data:product });
  } catch(err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const seller = await prisma.seller.findUnique({ where:{ userId:req.user.id } });
    const product = await prisma.product.findUnique({ where:{ id } });
    if (!product) throw new AppError('Product not found.', 404);
    if (product.sellerId !== seller?.id && req.user.role !== 'ADMIN') throw new AppError('Not authorized.', 403);
    const updated = await prisma.product.update({ where:{ id }, data:req.body });
    await invalidateProduct(product.slug);
    // Re-index in Typesense
    const fullProduct = await prisma.product.findUnique({ where: { id }, include: { category: { select: { name: true, emoji: true } }, seller: { select: { storeName: true, storeSlug: true } } } }).catch(() => null);
    if (fullProduct) indexProduct(fullProduct, fullProduct.category, fullProduct.seller).catch(() => {});
    res.json({ success:true, data:updated });
  } catch(err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const seller = await prisma.seller.findUnique({ where:{ userId:req.user.id } });
    const product = await prisma.product.findUnique({ where:{ id } });
    if (!product) throw new AppError('Product not found.', 404);
    if (product.sellerId !== seller?.id && req.user.role !== 'ADMIN') throw new AppError('Not authorized.', 403);
    await prisma.product.update({ where:{ id }, data:{ status:'INACTIVE' } });
    await invalidateProduct(product.slug);
    res.json({ success:true, message:'Product removed.' });
  } catch(err) { next(err); }
};

exports.getFeatured = async (req, res, next) => {
  try {
    const cached = await getCache(KEYS.featured());
    if (cached) return res.json(cached);
    const products = await prisma.product.findMany({
      where: { isFeatured:true, status:'ACTIVE' }, take:12, orderBy:{ soldCount:'desc' },
      include: { seller:{ select:{ storeName:true } }, category:{ select:{ name:true, emoji:true } } },
    });
    const result = { success:true, data:products };
    await setCache(KEYS.featured(), result, TTL.FEATURED);
    res.json(result);
  } catch(err) { next(err); }
};

// ===== VARIANTS =====
exports.getVariants = async (req, res, next) => {
  try {
    const variants = await prisma.productVariant.findMany({
      where: { productId: req.params.id, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: variants });
  } catch(err) { next(err); }
};

exports.addVariant = async (req, res, next) => {
  try {
    const { name, value, priceAdjust = 0, stock = 0, sku } = req.body;
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) throw new AppError('Product not found.', 404);
    if (product.sellerId !== seller?.id && req.user.role !== 'ADMIN') throw new AppError('Not authorized.', 403);

    const variant = await prisma.productVariant.create({
      data: { productId: req.params.id, name, value, priceAdjust, stock, sku },
    });
    res.status(201).json({ success: true, data: variant });
  } catch(err) { next(err); }
};

exports.updateVariant = async (req, res, next) => {
  try {
    const variant = await prisma.productVariant.update({
      where: { id: req.params.vid }, data: req.body,
    });
    res.json({ success: true, data: variant });
  } catch(err) { next(err); }
};

exports.deleteVariant = async (req, res, next) => {
  try {
    await prisma.productVariant.update({ where: { id: req.params.vid }, data: { isActive: false } });
    res.json({ success: true, message: 'Variant removed.' });
  } catch(err) { next(err); }
};
