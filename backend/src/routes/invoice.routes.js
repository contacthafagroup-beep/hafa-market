'use strict';
/**
 * Invoice Routes
 * GET /api/v1/orders/:id/invoice  — returns HTML invoice (buyer or seller)
 * GET /api/v1/orders/:id/packing-slip — returns packing slip HTML (seller only)
 *
 * We generate HTML that the browser can print-to-PDF.
 * No external PDF library needed — keeps the bundle lean.
 */
const router = require('express').Router({ mergeParams: true });
const prisma  = require('../config/prisma');
const { protect } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');

function etb(n) { return `ETB ${(n || 0).toFixed(2)}`; }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-ET', { year:'numeric', month:'long', day:'numeric' }); }

// ── Shared HTML shell ──────────────────────────────────────────────────────────
function htmlShell(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1f2937;font-size:14px}
    .logo{font-size:1.4rem;font-weight:900;color:#2E7D32}
    .logo span{color:#1f2937}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #f3f4f6}
    .badge{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:3px 10px;border-radius:50px;font-size:.75rem;font-weight:700;display:inline-block}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}
    .info-box{background:#f9fafb;border-radius:10px;padding:14px}
    .info-box h4{font-size:.7rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    th{background:#f9fafb;padding:9px 8px;text-align:left;font-size:.72rem;color:#6b7280;text-transform:uppercase;letter-spacing:.4px}
    td{padding:9px 8px;border-bottom:1px solid #f3f4f6;font-size:.88rem}
    .tr{text-align:right}.tc{text-align:center}
    .total-row td{padding:12px 8px;font-weight:700;font-size:1rem;border-top:2px solid #2E7D32;color:#2E7D32}
    .footer{text-align:center;color:#9ca3af;font-size:.75rem;margin-top:36px;padding-top:16px;border-top:1px solid #f3f4f6}
    @media print{body{margin:10px}button{display:none}}
  </style>
</head>
<body>
  ${body}
  <script>
    // Auto-print when opened in new tab
    if(window.location.search.includes('print=1')) window.onload = () => window.print();
  </script>
</body>
</html>`;
}

// ── GET /orders/:id/invoice ────────────────────────────────────────────────────
router.get('/', protect, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        payment: true,
        address: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    });
    if (!order) throw new AppError('Order not found.', 404);

    // Allow buyer or any seller whose product is in the order
    const isBuyer = order.userId === req.user.id;
    const isSeller = req.user.role === 'SELLER' || req.user.role === 'ADMIN';
    if (!isBuyer && !isSeller) throw new AppError('Not authorized.', 403);

    const rows = order.items.map(i => `
      <tr>
        <td>${i.productName}</td>
        <td class="tc">${i.quantity} ${i.unit}</td>
        <td class="tr">${etb(i.unitPrice)}</td>
        <td class="tr" style="font-weight:700">${etb(i.totalPrice)}</td>
      </tr>`).join('');

    const body = `
      <div class="header">
        <div>
          <div class="logo">🌿 Hafa <span>Market</span></div>
          <div style="color:#6b7280;font-size:.8rem;margin-top:4px">Farm Fresh Delivered · Hossana, Ethiopia</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.2rem;font-weight:900">INVOICE</div>
          <div style="color:#6b7280;font-size:.82rem">#${order.id.slice(-8).toUpperCase()}</div>
          <div style="color:#6b7280;font-size:.82rem">${fmtDate(order.createdAt)}</div>
          <div class="badge" style="margin-top:6px">${order.status}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h4>Bill To</h4>
          <div style="font-weight:700">${order.address?.fullName || order.user?.name || 'Customer'}</div>
          <div style="color:#6b7280">${order.address?.phone || order.user?.phone || ''}</div>
          <div style="color:#6b7280">${order.address?.street || ''}</div>
          <div style="color:#6b7280">${order.address?.city || ''}, ${order.address?.country || 'Ethiopia'}</div>
        </div>
        <div class="info-box">
          <h4>Payment</h4>
          <div style="font-weight:700">${(order.payment?.method || '—').replace(/_/g,' ')}</div>
          <div style="color:#6b7280">Status: ${order.payment?.status || '—'}</div>
          ${order.payment?.paidAt ? `<div style="color:#6b7280">Paid: ${fmtDate(order.payment.paidAt)}</div>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr><th>Product</th><th class="tc">Qty</th><th class="tr">Unit Price</th><th class="tr">Total</th></tr>
        </thead>
        <tbody>
          ${rows}
          <tr><td colspan="3" style="text-align:right;color:#6b7280;padding:8px">Subtotal</td><td class="tr">${etb(order.subtotal)}</td></tr>
          <tr><td colspan="3" style="text-align:right;color:#6b7280;padding:8px">Delivery</td><td class="tr">${order.deliveryFee === 0 ? 'FREE' : etb(order.deliveryFee)}</td></tr>
          ${order.discount > 0 ? `<tr><td colspan="3" style="text-align:right;color:#2E7D32;padding:8px">Discount</td><td class="tr" style="color:#2E7D32">-${etb(order.discount)}</td></tr>` : ''}
          <tr class="total-row"><td colspan="3" style="text-align:right">Total</td><td class="tr">${etb(order.total)}</td></tr>
        </tbody>
      </table>

      <div class="footer">
        <p>Thank you for shopping with Hafa Market 🌿</p>
        <p>Questions? hello@hafamarket.com · +251 911 000 000</p>
        <p style="margin-top:6px;font-size:.68rem">Computer-generated invoice — no signature required.</p>
      </div>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlShell(`Invoice #${order.id.slice(-8).toUpperCase()} — Hafa Market`, body));
  } catch (err) { next(err); }
});

// ── GET /orders/:id/packing-slip ───────────────────────────────────────────────
router.get('/packing-slip', protect, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        address: true,
        delivery: { select: { trackingCode: true } },
        user: { select: { name: true, phone: true } },
      },
    });
    if (!order) throw new AppError('Order not found.', 404);
    if (req.user.role !== 'SELLER' && req.user.role !== 'ADMIN') throw new AppError('Sellers only.', 403);

    const rows = order.items.map(i => `
      <tr>
        <td>${i.productName}</td>
        <td class="tc" style="font-weight:700;font-size:1.1rem">${i.quantity} ${i.unit}</td>
        <td class="tc">☐</td>
      </tr>`).join('');

    const body = `
      <div class="header">
        <div>
          <div class="logo">🌿 Hafa <span>Market</span></div>
          <div style="color:#6b7280;font-size:.8rem;margin-top:4px">PACKING SLIP</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.1rem;font-weight:900">Order #${order.id.slice(-8).toUpperCase()}</div>
          <div style="color:#6b7280;font-size:.82rem">${fmtDate(order.createdAt)}</div>
          ${order.delivery?.trackingCode ? `<div style="color:#6b7280;font-size:.82rem">Tracking: ${order.delivery.trackingCode}</div>` : ''}
        </div>
      </div>

      <div class="info-box" style="margin-bottom:20px">
        <h4>Ship To</h4>
        <div style="font-weight:700;font-size:1rem">${order.address?.fullName || order.user?.name}</div>
        <div style="color:#6b7280">${order.address?.phone || order.user?.phone || ''}</div>
        <div style="color:#6b7280">${order.address?.street || ''}, ${order.address?.city || ''}</div>
      </div>

      <table>
        <thead>
          <tr><th>Product</th><th class="tc">Quantity</th><th class="tc">Packed ✓</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:24px;padding:16px;border:2px dashed #d1fae5;border-radius:12px;text-align:center;color:#6b7280;font-size:.82rem">
        Pack carefully · Include this slip · Handle with care 📦
      </div>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlShell(`Packing Slip #${order.id.slice(-8).toUpperCase()}`, body));
  } catch (err) { next(err); }
});

module.exports = router;
