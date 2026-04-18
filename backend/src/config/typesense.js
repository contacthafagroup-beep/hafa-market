'use strict';
const logger = require('./logger');

let client = null;

function getTypesense() {
  if (client) return client;
  try {
    const Typesense = require('typesense');
    client = new Typesense.Client({
      nodes: [{ host: process.env.TYPESENSE_HOST || 'localhost', port: parseInt(process.env.TYPESENSE_PORT || '8108'), protocol: 'http' }],
      apiKey: process.env.TYPESENSE_API_KEY || 'hafa-typesense-key',
      connectionTimeoutSeconds: 5,
    });
    return client;
  } catch (err) {
    logger.warn('Typesense not available — falling back to DB search');
    return null;
  }
}

const PRODUCT_SCHEMA = {
  name: 'products',
  fields: [
    { name: 'id',           type: 'string' },
    { name: 'name',         type: 'string' },
    { name: 'nameAm',       type: 'string', optional: true },
    { name: 'description',  type: 'string', optional: true },
    { name: 'price',        type: 'float' },
    { name: 'unit',         type: 'string' },
    { name: 'category',     type: 'string' },
    { name: 'categorySlug', type: 'string' },
    { name: 'sellerName',   type: 'string' },
    { name: 'sellerCity',   type: 'string', optional: true },
    { name: 'tags',         type: 'string[]', optional: true },
    { name: 'isOrganic',    type: 'bool' },
    { name: 'rating',       type: 'float' },
    { name: 'soldCount',    type: 'int32' },
    { name: 'stock',        type: 'float' },
    { name: 'slug',         type: 'string' },
    { name: 'images',       type: 'string[]', optional: true },
    { name: 'status',       type: 'string' },
  ],
  default_sorting_field: 'soldCount',
};

async function initTypesense(prisma) {
  const ts = getTypesense();
  if (!ts) return false;
  try {
    // Create collection if not exists
    try { await ts.collections('products').retrieve(); }
    catch { await ts.collections().create(PRODUCT_SCHEMA); logger.info('Typesense: products collection created'); }

    // Index all active products
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: {
        category: { select: { name: true, slug: true } },
        seller:   { select: { storeName: true, city: true } },
      },
    });

    if (products.length > 0) {
      const docs = products.map(p => ({
        id:           p.id,
        name:         p.name,
        nameAm:       p.nameAm || '',
        description:  p.description || '',
        price:        p.price,
        unit:         p.unit,
        category:     p.category?.name || '',
        categorySlug: p.category?.slug || '',
        sellerName:   p.seller?.storeName || '',
        sellerCity:   p.seller?.city || '',
        tags:         p.tags || [],
        isOrganic:    p.isOrganic,
        rating:       p.rating || 0,
        soldCount:    p.soldCount || 0,
        stock:        p.stock || 0,
        slug:         p.slug,
        images:       p.images || [],
        status:       p.status,
      }));
      await ts.collections('products').documents().import(docs, { action: 'upsert' });
      logger.info('Typesense: indexed ' + products.length + ' products');
    }
    return true;
  } catch (err) {
    logger.warn('Typesense init failed: ' + err.message + ' — using DB search fallback');
    return false;
  }
}

async function searchProducts(query, filters = {}) {
  const ts = getTypesense();
  if (!ts) return null;
  try {
    const searchParams = {
      q:                query,
      query_by:         'name,nameAm,description,tags,category,sellerName',
      query_by_weights: '5,4,2,3,2,1',
      typo_tokens_threshold: 1,
      num_typos:        2,
      per_page:         filters.limit || 20,
      page:             filters.page  || 1,
      sort_by:          filters.sort === 'price:asc' ? 'price:asc' : filters.sort === 'price:desc' ? 'price:desc' : 'soldCount:desc',
    };

    // Filters
    const filterParts = ['status:=ACTIVE'];
    if (filters.category)  filterParts.push('categorySlug:=' + filters.category);
    if (filters.isOrganic) filterParts.push('isOrganic:=true');
    if (filters.minPrice)  filterParts.push('price:>=' + filters.minPrice);
    if (filters.maxPrice)  filterParts.push('price:<=' + filters.maxPrice);
    if (filterParts.length) searchParams.filter_by = filterParts.join(' && ');

    const result = await ts.collections('products').documents().search(searchParams);
    return {
      data: result.hits.map(h => ({ ...h.document, _highlight: h.highlights })),
      total: result.found,
      page:  result.page,
    };
  } catch (err) {
    logger.warn('Typesense search failed: ' + err.message);
    return null;
  }
}

async function indexProduct(product, category, seller) {
  const ts = getTypesense();
  if (!ts) return;
  try {
    await ts.collections('products').documents().upsert({
      id:           product.id,
      name:         product.name,
      nameAm:       product.nameAm || '',
      description:  product.description || '',
      price:        product.price,
      unit:         product.unit,
      category:     category?.name || '',
      categorySlug: category?.slug || '',
      sellerName:   seller?.storeName || '',
      sellerCity:   seller?.city || '',
      tags:         product.tags || [],
      isOrganic:    product.isOrganic,
      rating:       product.rating || 0,
      soldCount:    product.soldCount || 0,
      stock:        product.stock || 0,
      slug:         product.slug,
      images:       product.images || [],
      status:       product.status,
    });
  } catch (err) {
    logger.warn('Typesense index product failed: ' + err.message);
  }
}

async function deleteProduct(productId) {
  const ts = getTypesense();
  if (!ts) return;
  try { await ts.collections('products').documents(productId).delete(); } catch {}
}

module.exports = { getTypesense, initTypesense, searchProducts, indexProduct, deleteProduct };
