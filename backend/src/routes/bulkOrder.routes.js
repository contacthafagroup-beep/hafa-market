'use strict';
const router = require('express').Router();
const prisma  = require('../config/prisma');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');
const emailService = require('../services/email.service');
const logger = require('../config/logger');

// ── Public: submit bulk order request ────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      orgName, orgType, city, contactName, phone, email,
      items, deliveryDate, isRecurring, recurringFreq,
      notes, language, userId,
    } = req.body;

    if (!orgName || !contactName || !phone || !items?.length) {
      throw new AppError('Organization name, contact, phone and items are required.', 400);
    }

    // Estimate total from items
    let totalEstimate = 0;
    for (const item of items) {
      if (item.unitPrice && item.quantity) {
        totalEstimate += parseFloat(item.unitPrice) * parseFloat(item.quantity);
      }
    }

    const bulk = await prisma.bulkOrder.create({
      data: {
        orgName, orgType: orgType || 'OTHER',
        city: city || 'Addis Ababa',
        contactName, phone, email,
        items, totalEstimate: totalEstimate || null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        isRecurring: !!isRecurring,
        recurringFreq: isRecurring ? recurringFreq : null,
        notes, language: language || 'en',
        userId: userId || null,
        status: 'PENDING',
      },
    });

    // Notify admin via email
    emailService.sendEmail({
      to: process.env.EMAIL_USER,
      subject: `🏢 New Bulk Order Request — ${orgName} (${orgType})`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#2E7D32">🏢 New Bulk Order Request</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;color:#6b7280">Organization</td><td style="padding:8px;font-weight:700">${orgName} (${orgType})</td></tr>
            <tr><td style="padding:8px;color:#6b7280">City</td><td style="padding:8px">${city}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Contact</td><td style="padding:8px">${contactName} · ${phone}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Email</td><td style="padding:8px">${email || '—'}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Items</td><td style="padding:8px">${items.map((i) => `${i.quantity} ${i.unit} of ${i.product}`).join(', ')}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Delivery Date</td><td style="padding:8px">${deliveryDate || 'Flexible'}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Recurring</td><td style="padding:8px">${isRecurring ? `Yes — ${recurringFreq}` : 'No'}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Est. Value</td><td style="padding:8px;font-weight:700;color:#2E7D32">${totalEstimate ? `ETB ${totalEstimate.toFixed(2)}` : 'TBD'}</td></tr>
          </table>
          <a href="${process.env.CLIENT_URL}/admin/bulk-orders" style="display:inline-block;margin-top:16px;background:#2E7D32;color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700">
            Review in Admin Panel →
          </a>
        </div>
      `,
    }).catch(() => {});

    // Send confirmation to requester if email provided
    if (email) {
      const msgs = {
        en: { subject: 'Bulk Order Request Received — Hafa Market', body: `Hi ${contactName}, we received your bulk order request and will contact you within 2 hours with a quote.` },
        am: { subject: 'የጅምላ ትዕዛዝ ጥያቄ ተቀብሏል — Hafa Market', body: `ሰላም ${contactName}፣ የጅምላ ትዕዛዝ ጥያቄዎን ተቀብለናል። በ2 ሰዓት ውስጥ ዋጋ ይልካሉ።` },
      };
      const msg = msgs[language] || msgs.en;
      emailService.sendEmail({
        to: email, subject: msg.subject,
        html: `<div style="font-family:sans-serif;padding:24px;max-width:480px">
          <h2 style="color:#2E7D32">🌿 Hafa Market</h2>
          <p>${msg.body}</p>
          <p style="color:#9ca3af;font-size:.85rem">Reference: #${bulk.id.slice(-8).toUpperCase()}</p>
        </div>`,
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      data: { id: bulk.id, reference: bulk.id.slice(-8).toUpperCase() },
      message: 'Bulk order request submitted! We will contact you within 2 hours.',
    });
  } catch (err) { next(err); }
});

// ── Public: get bulk product listings (pre-listed bulk deals) ─────────────────
router.get('/listings', async (req, res, next) => {
  try {
    const { category, city } = req.query;
    const where = { status: 'ACTIVE', minOrder: { gte: 5 } };
    if (category) where.category = { slug: category };

    const products = await prisma.product.findMany({
      where,
      take: 20,
      orderBy: { soldCount: 'desc' },
      include: {
        seller: { select: { storeName: true, city: true, rating: true } },
        category: { select: { name: true, emoji: true } },
      },
    });
    res.json({ success: true, data: products });
  } catch (err) { next(err); }
});

// ── Protected: get my bulk orders (logged-in user) ────────────────────────────
router.get('/my', protect, async (req, res, next) => {
  try {
    const orders = await prisma.bulkOrder.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (err) { next(err); }
});

// ── Protected: one-click reorder ──────────────────────────────────────────────
router.post('/:id/reorder', protect, async (req, res, next) => {
  try {
    const original = await prisma.bulkOrder.findUnique({ where: { id: req.params.id } });
    if (!original || original.userId !== req.user.id) throw new AppError('Not found.', 404);

    const reorder = await prisma.bulkOrder.create({
      data: {
        orgName: original.orgName, orgType: original.orgType,
        city: original.city, contactName: original.contactName,
        phone: original.phone, email: original.email,
        items: original.items, isRecurring: original.isRecurring,
        recurringFreq: original.recurringFreq,
        language: original.language, userId: req.user.id,
        notes: `Reorder of #${original.id.slice(-8).toUpperCase()}`,
        status: 'PENDING',
      },
    });
    res.status(201).json({ success: true, data: reorder, message: 'Reorder submitted!' });
  } catch (err) { next(err); }
});

// ── Admin: get all bulk orders ────────────────────────────────────────────────
router.get('/', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { status, city, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (city)   where.city   = { contains: city, mode: 'insensitive' };

    const [orders, total] = await Promise.all([
      prisma.bulkOrder.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bulkOrder.count({ where }),
    ]);
    res.json({ success: true, data: orders, pagination: { page: parseInt(page), total, pages: Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
});

// ── Admin: update bulk order (send quote, update status) ──────────────────────
router.patch('/:id', protect, restrictTo('ADMIN'), async (req, res, next) => {
  try {
    const { status, quotedPrice, adminNotes, paymentMethod } = req.body;
    const order = await prisma.bulkOrder.update({
      where: { id: req.params.id },
      data: {
        ...(status        && { status }),
        ...(quotedPrice   && { quotedPrice: parseFloat(quotedPrice), quotedBy: req.user.id }),
        ...(adminNotes    && { adminNotes }),
        ...(paymentMethod && { paymentMethod }),
        updatedAt: new Date(),
      },
    });

    // Notify requester when quote is sent
    if (status === 'QUOTED' && order.email && quotedPrice) {
      emailService.sendEmail({
        to: order.email,
        subject: `💰 Your Bulk Order Quote — Hafa Market`,
        html: `<div style="font-family:sans-serif;padding:24px;max-width:480px">
          <h2 style="color:#2E7D32">🌿 Hafa Market — Bulk Order Quote</h2>
          <p>Hi ${order.contactName},</p>
          <p>Your bulk order quote is ready:</p>
          <div style="background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0">
            <p style="font-size:2rem;font-weight:900;color:#2E7D32;margin:0">ETB ${parseFloat(quotedPrice).toFixed(2)}</p>
            <p style="color:#6b7280;margin:4px 0 0">Reference: #${order.id.slice(-8).toUpperCase()}</p>
          </div>
          ${adminNotes ? `<p><strong>Notes:</strong> ${adminNotes}</p>` : ''}
          <p>To confirm this order, please contact us or reply to this email.</p>
          <a href="tel:${process.env.SUPPORT_PHONE || '+251911000000'}" style="display:inline-block;background:#2E7D32;color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700">📞 Call to Confirm</a>
        </div>`,
      }).catch(() => {});
    }

    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

module.exports = router;
