const { z } = require('zod');

exports.createOrderSchema = z.object({
  addressId:     z.string().uuid('Invalid address ID'),
  paymentMethod: z.enum([
    'MPESA', 'CARD', 'FLUTTERWAVE', 'CHAPA',
    'CASH_ON_DELIVERY', 'PAYMENT_ON_DELIVERY',
    'PAYPAL', 'TELEBIRR', 'CBE_BIRR',
    'BANK_TRANSFER', 'CHAPA_BANK',
  ]),
  items: z.array(z.object({
    productId: z.string().uuid('Invalid product ID'),
    quantity:  z.number({ coerce: true }).positive().max(1000),
  })).min(1, 'Order must have at least one item').max(50),
  promoCode: z.string().max(20).optional(),
  notes:     z.string().max(500).optional(),
});

exports.cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

exports.updateStatusSchema = z.object({
  status: z.enum(['CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','REFUNDED']),
  note:   z.string().max(500).optional(),
});
