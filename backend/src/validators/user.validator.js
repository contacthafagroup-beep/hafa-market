const { z } = require('zod');

exports.updateProfileSchema = z.object({
  name:     z.string().min(2).max(100).optional(),
  avatar:   z.string().url().optional(),
  language: z.enum(['en','am','om','sw','fr','ar']).optional(),
  fcmToken: z.string().max(500).optional(),
});

exports.addAddressSchema = z.object({
  label:     z.string().max(50).default('Home'),
  fullName:  z.string().min(2).max(100),
  phone:     z.string().regex(/^\+?[0-9]{9,15}$/),
  street:    z.string().min(3).max(200),
  city:      z.string().min(2).max(100),
  region:    z.string().min(2).max(100),
  country:   z.string().max(100).default('Ethiopia'),
  postalCode:z.string().max(20).optional(),
  latitude:  z.number({ coerce: true }).min(-90).max(90).optional(),
  longitude: z.number({ coerce: true }).min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
});

exports.toggleWishlistSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
});
