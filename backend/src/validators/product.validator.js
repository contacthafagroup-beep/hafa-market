const { z } = require('zod');

exports.createProductSchema = z.object({
  name:         z.string().min(2).max(200),
  nameAm:       z.string().max(200).optional(),
  nameOm:       z.string().max(200).optional(),
  categoryId:   z.string().uuid('Invalid category ID'),
  description:  z.string().max(5000).optional(),
  price:        z.number({ coerce: true }).positive('Price must be positive'),
  comparePrice: z.number({ coerce: true }).positive().optional(),
  unit:         z.string().max(20).default('kg'),
  minOrder:     z.number({ coerce: true }).positive().default(1),
  stock:        z.number({ coerce: true }).min(0).default(0),
  images:       z.array(z.string().url()).max(10).default([]),
  tags:         z.array(z.string().max(50)).max(20).default([]),
  isOrganic:    z.boolean().default(false),
  weight:       z.number({ coerce: true }).positive().optional(),
  origin:       z.string().max(100).optional(),
});

exports.updateProductSchema = exports.createProductSchema.partial();

exports.productQuerySchema = z.object({
  page:      z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit:     z.string().regex(/^\d+$/).transform(Number).default('20'),
  category:  z.string().optional(),
  search:    z.string().max(200).optional(),
  minPrice:  z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  maxPrice:  z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  minRating: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  sort:      z.enum(['createdAt','price','rating','soldCount']).default('createdAt'),
  order:     z.enum(['asc','desc']).default('desc'),
  isOrganic: z.enum(['true','false']).optional(),
  isFeatured:z.enum(['true','false']).optional(),
  sellerId:  z.string().uuid().optional(),
});
