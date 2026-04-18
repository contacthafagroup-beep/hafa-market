'use strict';
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// ===== TRANSPORTER =====
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ===== TEMPLATE CACHE =====
const templateCache = {};

function loadTemplate(name) {
  if (templateCache[name]) return templateCache[name];
  const filePath = path.join(__dirname, '../templates/email', `${name}.hbs`);
  if (fs.existsSync(filePath)) {
    const source = fs.readFileSync(filePath, 'utf8');
    templateCache[name] = handlebars.compile(source);
    return templateCache[name];
  }
  return null;
}

// ===== BASE LAYOUT =====
const BASE_LAYOUT = handlebars.compile(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>{{subject}}</title>
  <style>
    body{margin:0;padding:0;background:#f4f4f4;font-family:'Poppins',Arial,sans-serif}
    .wrapper{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#1b5e20,#2E7D32);padding:32px 40px;text-align:center}
    .header h1{color:#fff;margin:0;font-size:24px;font-weight:800}
    .header p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px}
    .body{padding:40px}
    .body h2{color:#1b5e20;font-size:20px;margin:0 0 16px}
    .body p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}
    .btn{display:inline-block;background:#2E7D32;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;margin:8px 0}
    .btn-orange{background:#FFA726}
    .info-box{background:#f0fdf4;border-left:4px solid #2E7D32;border-radius:8px;padding:16px 20px;margin:20px 0}
    .info-box p{margin:4px 0;font-size:14px}
    .divider{height:1px;background:#e5e7eb;margin:24px 0}
    .footer{background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb}
    .footer p{color:#9ca3af;font-size:12px;margin:4px 0}
    .footer a{color:#2E7D32;text-decoration:none}
    .badge{display:inline-block;background:#e8f5e9;color:#2E7D32;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700}
    table.order-items{width:100%;border-collapse:collapse;margin:16px 0}
    table.order-items th{background:#f9fafb;padding:10px 14px;text-align:left;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb}
    table.order-items td{padding:12px 14px;font-size:14px;border-bottom:1px solid #f3f4f6;color:#374151}
    .total-row td{font-weight:800;color:#1b5e20;font-size:15px;border-top:2px solid #e5e7eb}
  </style>
</head>
<body>
  <div style="padding:24px 16px">
    <div class="wrapper">
      <div class="header">
        <h1>🌿 Hafa Market</h1>
        <p>Farm Fresh Delivered</p>
      </div>
      <div class="body">{{{content}}}</div>
      <div class="footer">
        <p>© 2026 Hafa Market · <a href="{{clientUrl}}">hafamarket.com</a></p>
        <p>You received this email because you have an account with Hafa Market.</p>
        <p><a href="{{clientUrl}}/unsubscribe">Unsubscribe</a> · <a href="{{clientUrl}}/privacy">Privacy Policy</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`);

// ===== TEMPLATE BUILDERS =====
const TEMPLATES = {
  welcome: (d) => {
    const firstName = d.name?.split(' ')[0] || d.name || 'there';
    return `
    <h2>Hi ${firstName}, Welcome to Hafa Market! 🎉</h2>
    <p>Your account has been successfully created, and you're now part of a growing community where buying and selling is <strong>fast, secure, and convenient</strong>.</p>

    <div class="info-box">
      <p style="font-weight:700;margin-bottom:10px">🚀 What you can do now:</p>
      <p>🛒 Browse thousands of products across multiple categories</p>
      <p>💳 Enjoy secure and flexible payment options</p>
      <p>📦 Track your orders in real-time</p>
      <p>❤️ Save your favorite items to your wishlist</p>
      <p>🤖 Get personalized recommendations with our AI assistant</p>
    </div>

    <div style="background:#fff8e1;border-left:4px solid #FFA726;border-radius:8px;padding:16px 20px;margin:20px 0">
      <p style="margin:0;font-weight:700;color:#e65100">🎁 Getting Started Tip:</p>
      <p style="margin:8px 0 0;color:#374151;font-size:14px">Complete your profile and add your delivery address to enjoy a smoother checkout experience.</p>
    </div>

    <a href="${d.clientUrl}" class="btn" style="display:inline-block;margin-bottom:8px">🛒 Start Shopping</a>
    <a href="${d.clientUrl}/account" class="btn btn-orange" style="display:inline-block;margin-left:8px">👤 Complete Profile</a>

    <div class="divider"></div>

    <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin:16px 0">
      <p style="font-weight:800;color:#1b5e20;font-size:15px;margin:0 0 12px">🇪🇹 አማርኛ</p>
      <p style="color:#374151;font-size:14px;line-height:1.8;margin:0">
        ሰላም <strong>${firstName}</strong>፣<br/>
        እንኳን ወደ Hafa Market በደህና መጡ! 🎉 መለያዎ በተሳካ ሁኔታ ተፈጥሯል፣ እና አሁን በፍጥነት፣ በደህንነት እና በቀላሉ የሚሰራ የግዢ እና የሽያጭ ማህበረሰብ አካል ሆነዋል።
        <br/><br/>
        <strong>🚀 አሁን ማድረግ የሚችሉት:</strong><br/>
        🛒 በብዙ ክፍሎች ውስጥ ያሉ ሺዎች ምርቶችን ይመልከቱ<br/>
        💳 የተለያዩ እና የደህንነት የክፍያ መንገዶችን ይጠቀሙ<br/>
        📦 ትዕዛዞችዎን በቀጥታ ይከታተሉ<br/>
        ❤️ የሚወዱትን ምርቶች በwishlist ያስቀምጡ<br/>
        🤖 በAI የተመሰረተ ምክር ያግኙ<br/>
        <br/>
        <strong>🎁 የመጀመሪያ ምክር:</strong><br/>
        ፕሮፋይልዎን ያሟሉ እና የመላኪያ አድራሻዎን ያክሉ ለቀላል ግዢ ሂደት።<br/>
        <br/>
        ጥያቄ ካለዎት ወይም እርዳታ ካስፈለገዎት እባክዎ ይገናኙን።<br/>
        👉 ለዚህ ኢሜይል መልስ መላክ ወይም በመተግበሪያው ውስጥ ይገናኙን።<br/>
        <br/>
        እንኳን ደህና መጡ፣ መልካም ግዢ!<br/>
        <em>ከክብር ጋር፣ የHafa Market ቡድን</em>
      </p>
    </div>

    <div class="divider"></div>
    <p style="font-size:13px;color:#6b7280;text-align:center">
      📍 Hafa Market — Smart Shopping, Simplified<br/>
      🌐 <a href="${d.clientUrl}" style="color:#2E7D32">www.hafamarket.com</a>
    </p>
  `},

  orderShipped: (d) => `
    <h2>Your Order is On Its Way! 🚚</h2>
    <p>Hi ${d.name}, great news! Your order <strong>#${d.orderId}</strong> has been shipped and is heading to you.</p>
    <div class="info-box">
      <p>📍 <strong>Delivering to:</strong> ${d.address}</p>
      <p>⏱️ <strong>Estimated delivery:</strong> 24–48 hours</p>
    </div>
    <a href="${d.clientUrl}/account/orders" class="btn">Track Your Order</a>
  `,

  orderConfirmation: (d) => `
    <h2>Order Confirmed! ✅</h2>
    <p>Hi ${d.name}, your order has been confirmed and is being prepared.</p>
    <div class="info-box">
      <p>📦 <strong>Order ID:</strong> #${d.orderId}</p>
      <p>📍 <strong>Delivery to:</strong> ${d.address}</p>
      <p>⏱️ <strong>Estimated delivery:</strong> 24–48 hours</p>
    </div>
    <table class="order-items">
      <thead><tr><th>Product</th><th>Qty</th><th>Price</th></tr></thead>
      <tbody>
        ${d.items.map(i => `<tr><td>${i.productName}</td><td>${i.quantity} ${i.unit}</td><td>$${i.totalPrice.toFixed(2)}</td></tr>`).join('')}
        <tr class="total-row"><td colspan="2">Total</td><td>$${d.total.toFixed(2)}</td></tr>
      </tbody>
    </table>
    <a href="${d.clientUrl}/track/${d.orderId}" class="btn">Track Your Order</a>
  `,

  orderDelivered: (d) => `
    <h2>Your Order Has Been Delivered! 📦</h2>
    <p>Hi ${d.name}, your order <strong>#${d.orderId}</strong> has been delivered. We hope you enjoy your fresh products!</p>
    <a href="${d.clientUrl}/account/orders/${d.orderId}/review" class="btn btn-orange">Leave a Review</a>
    <div class="divider"></div>
    <p>Earn <strong>loyalty points</strong> on every purchase. <a href="${d.clientUrl}/account">View your points →</a></p>
  `,

  passwordReset: (d) => `
    <h2>Password Reset Request 🔐</h2>
    <p>Hi ${d.name}, we received a request to reset your password.</p>
    <div class="info-box">
      <p>Your OTP code is:</p>
      <p style="font-size:36px;font-weight:900;color:#1b5e20;letter-spacing:8px;text-align:center">${d.otp}</p>
      <p style="text-align:center;color:#6b7280;font-size:13px">Expires in <strong>10 minutes</strong></p>
    </div>
    <p>If you didn't request this, please ignore this email. Your account is safe.</p>
  `,

  sellerApproved: (d) => `
    <h2>Your Seller Account is Approved! 🎉</h2>
    <p>Hi ${d.name}, congratulations! Your store <strong>${d.storeName}</strong> has been verified and is now live on Hafa Market.</p>
    <div class="info-box">
      <p>🛒 <strong>50,000+</strong> buyers ready to discover your products</p>
      <p>💰 <strong>Low commission</strong> rates with direct payouts</p>
      <p>📊 <strong>Full analytics</strong> dashboard available</p>
    </div>
    <a href="${d.clientUrl}/dashboard" class="btn">Go to Seller Dashboard</a>
  `,

  sellerSuspended: (d) => `
    <h2>Seller Account Suspended ⚠️</h2>
    <p>Hi ${d.name}, your seller account <strong>${d.storeName}</strong> has been temporarily suspended.</p>
    <div class="info-box">
      <p><strong>Reason:</strong> ${d.reason || 'Policy violation'}</p>
    </div>
    <p>Please contact our support team to resolve this issue.</p>
    <a href="mailto:hello@hafamarket.com" class="btn">Contact Support</a>
  `,

  payoutProcessed: (d) => `
    <h2>Payout Processed! 💰</h2>
    <p>Hi ${d.name}, your payout of <strong>$${d.amount.toFixed(2)}</strong> has been processed.</p>
    <div class="info-box">
      <p>💳 <strong>Method:</strong> ${d.method}</p>
      <p>📱 <strong>Account:</strong> ${d.accountRef}</p>
      <p>📅 <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    </div>
    <p>Funds typically arrive within 1–3 business days depending on your payment method.</p>
  `,
};

// ===== SEND EMAIL =====
async function sendEmail({ to, subject, template, data, html, text }) {
  try {
    let finalHtml = html;

    if (template && TEMPLATES[template]) {
      const content = TEMPLATES[template]({ ...data, clientUrl: process.env.CLIENT_URL || 'https://hafamarket.com' });
      finalHtml = BASE_LAYOUT({ subject, content, clientUrl: process.env.CLIENT_URL || 'https://hafamarket.com' });
    }

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Hafa Market" <noreply@hafamarket.com>',
      to, subject,
      html: finalHtml,
      text: text || subject,
    });

    logger.info(`Email sent [${template || 'custom'}] → ${to}`);
    return true;
  } catch (err) {
    logger.error(`Email failed → ${to}: ${err.message}`);
    throw err;
  }
}

// ===== CONVENIENCE METHODS =====
exports.sendEmail = sendEmail;

exports.sendWelcome = (user) => sendEmail({
  to: user.email, subject: 'Welcome to Hafa Market 🌿',
  template: 'welcome', data: { name: user.name },
});

exports.sendOrderConfirmation = (user, order) => sendEmail({
  to: user.email, subject: `Order Confirmed #${order.id.slice(-8).toUpperCase()} — Hafa Market`,
  template: 'orderConfirmation',
  data: { name: user.name, orderId: order.id.slice(-8).toUpperCase(),
          address: `${order.address?.city}, ${order.address?.country}`,
          items: order.items || [], total: order.total },
});

exports.sendOrderDelivered = (user, order) => sendEmail({
  to: user.email, subject: 'Your order has been delivered! 📦 — Hafa Market',
  template: 'orderDelivered',
  data: { name: user.name, orderId: order.id.slice(-8).toUpperCase() },
});

exports.sendPasswordReset = (user, otp) => sendEmail({
  to: user.email, subject: 'Password Reset OTP — Hafa Market',
  template: 'passwordReset', data: { name: user.name, otp },
});

exports.sendSellerApproved = (user, seller) => sendEmail({
  to: user.email, subject: 'Your seller account is approved! 🎉 — Hafa Market',
  template: 'sellerApproved', data: { name: user.name, storeName: seller.storeName },
});

exports.sendSellerSuspended = (user, seller, reason) => sendEmail({
  to: user.email, subject: 'Seller Account Suspended — Hafa Market',
  template: 'sellerSuspended', data: { name: user.name, storeName: seller.storeName, reason },
});

exports.sendPayoutProcessed = (user, payout) => sendEmail({
  to: user.email, subject: 'Payout Processed 💰 — Hafa Market',
  template: 'payoutProcessed',
  data: { name: user.name, amount: payout.amount, method: payout.method, accountRef: payout.accountRef },
});
