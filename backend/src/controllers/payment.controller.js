const prisma  = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const logger  = require('../config/logger');
const {
  markPaid, markFailed, findByRef,
  makeIdempotencyKey, acquireIdempotencyLock,
  checkDoublePayment, setPaymentExpiry, logPaymentEvent,
} = require('../services/payment.service');

// ===== INITIATE PAYMENT =====
exports.initiatePayment = async (req, res, next) => {
  try {
    const { orderId, method } = req.body;

    // ===== DOUBLE PAYMENT CHECK =====
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, user: true },
    });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== req.user.id) throw new AppError('Not authorized.', 403);

    const dpCheck = await checkDoublePayment(orderId);
    if (!dpCheck.safe) {
      if (dpCheck.expired) throw new AppError(dpCheck.reason, 410); // 410 Gone
      throw new AppError(dpCheck.reason, 409); // 409 Conflict
    }

    // ===== STOCK VALIDATION =====
    const items = await prisma.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || product.status !== 'ACTIVE') {
        throw new AppError(`Product "${item.productName}" is no longer available.`, 400);
      }
      if (product.stock < item.quantity) {
        throw new AppError(`Insufficient stock for "${item.productName}". Available: ${product.stock} ${product.unit}.`, 400);
      }
    }

    await logPaymentEvent(order.payment.id, 'PAYMENT_INITIATED', 'PENDING',
      { method, orderId }, req.ip);

    let result;
    switch (method) {
      case 'MPESA':               result = await initiateMpesa(order); break;
      case 'FLUTTERWAVE':         result = await initiateFlutterwave(order); break;
      case 'CARD':                result = await initiateStripe(order); break;
      case 'CHAPA':               result = await initiateChapa(order); break;
      case 'TELEBIRR':            result = await initiateChapa(order, 'telebirr'); break;
      case 'CBE_BIRR':            result = await initiateChapa(order, 'cbebirr'); break;
      case 'BANK_TRANSFER':
        // Update method, return bank accounts list
        await prisma.payment.update({ where: { orderId }, data: { method: 'BANK_TRANSFER', status: 'PENDING' } });
        result = {
          method: 'BANK_TRANSFER',
          message: 'Please use GET /api/v1/bank-transfers/accounts to get bank details, then POST /api/v1/bank-transfers/initiate with your orderId.',
          orderId,
        };
        break;
      case 'CHAPA_BANK':
        await prisma.payment.update({ where: { orderId }, data: { method: 'CHAPA_BANK', status: 'PENDING' } });
        result = {
          method: 'CHAPA_BANK',
          message: 'Please use POST /api/v1/bank-transfers/chapa-bank with your orderId and bank details.',
          orderId,
        };
        break;
      case 'CASH_ON_DELIVERY':
      case 'PAYMENT_ON_DELIVERY':
        await prisma.payment.update({
          where: { orderId },
          data: { method, status: 'PENDING' },
        });
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'CONFIRMED',
                  statusHistory: { create: { status: 'CONFIRMED',
                    note: method === 'PAYMENT_ON_DELIVERY'
                      ? 'Payment on delivery — agent will collect cash'
                      : 'Cash on delivery confirmed' } } },
        });
        result = {
          method,
          message: method === 'PAYMENT_ON_DELIVERY'
            ? 'Order confirmed. Our delivery agent will collect payment when your order arrives.'
            : 'Order confirmed. Please have cash ready for delivery.',
          orderId,
        };
        break;
      default: throw new AppError('Unsupported payment method.', 400);
    }

    // Set payment expiry
    const expiresAt = await setPaymentExpiry(orderId, method);
    res.json({ success: true, data: { ...result, expiresAt } });
  } catch (err) { next(err); }
};

// ===== M-PESA STK PUSH =====
async function initiateMpesa(order) {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL } = process.env;

  // Get access token
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${auth}` },
  });
  const { access_token } = await tokenRes.json();

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
  const phone = order.user.phone?.replace(/^0/, '254').replace(/^\+/, '');

  const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(order.total),
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: `HAFA-${order.id.slice(-8).toUpperCase()}`,
      TransactionDesc: 'Hafa Market Order Payment',
    }),
  });

  const data = await stkRes.json();
  if (data.ResponseCode !== '0') throw new AppError(`M-Pesa error: ${data.ResponseDescription}`, 400);

  await prisma.payment.update({
    where: { orderId: order.id },
    data: { method: 'MPESA', providerRef: data.CheckoutRequestID },
  });

  return { checkoutRequestId: data.CheckoutRequestID, message: 'STK push sent to your phone.' };
}

// ===== M-PESA CALLBACK =====
exports.mpesaCallback = async (req, res, next) => {
  try {
    const { Body } = req.body;
    const stk = Body?.stkCallback;
    if (!stk) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    logger.info(`M-Pesa callback: CheckoutRequestID=${stk.CheckoutRequestID} ResultCode=${stk.ResultCode}`);

    const payment = await findByRef('providerRef', stk.CheckoutRequestID);
    if (!payment) {
      logger.warn(`M-Pesa callback: no payment found for ref ${stk.CheckoutRequestID}`);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (stk.ResultCode === 0) {
      // ===== IDEMPOTENCY CHECK =====
      const idemKey = makeIdempotencyKey('mpesa', stk.CheckoutRequestID);
      const isNew   = await acquireIdempotencyLock(idemKey);
      if (!isNew) {
        logger.info(`M-Pesa duplicate webhook ignored: ${stk.CheckoutRequestID}`);
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      // SUCCESS
      const items     = stk.CallbackMetadata?.Item || [];
      const mpesaCode = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const amount    = items.find(i => i.Name === 'Amount')?.Value;
      const phone     = items.find(i => i.Name === 'PhoneNumber')?.Value;

      await prisma.payment.update({ where: { id: payment.id }, data: { mpesaCode } });
      await markPaid(payment.id, {
        transactionId: mpesaCode,
        note: `M-Pesa payment received. Code: ${mpesaCode}, Phone: ${phone}, Amount: KES ${amount}`,
        ip: req.ip,
      });
    } else {
      // FAILURE
      const reason = stk.ResultDesc || 'M-Pesa payment failed';
      logger.warn(`M-Pesa STK failed: ${reason} (code ${stk.ResultCode})`);
      await markFailed(payment.id, { reason, code: stk.ResultCode });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    logger.error('M-Pesa callback error:', err);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // always 200 to Safaricom
  }
};

// ===== FLUTTERWAVE =====
async function initiateFlutterwave(order) {
  const payload = {
    tx_ref: `HAFA-${order.id.slice(-8).toUpperCase()}-${Date.now()}`,
    amount: order.total,
    currency: 'USD',
    redirect_url: `${process.env.CLIENT_URL}/order/success?orderId=${order.id}`,
    customer: { email: order.user.email, name: order.user.name, phonenumber: order.user.phone },
    customizations: { title: 'Hafa Market', description: `Order #${order.id.slice(-8).toUpperCase()}`, logo: '' },
  };

  const res = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.status !== 'success') throw new AppError(`Flutterwave error: ${data.message}`, 400);

  await prisma.payment.update({
    where: { orderId: order.id },
    data: { method: 'FLUTTERWAVE', providerRef: payload.tx_ref },
  });

  return { paymentLink: data.data.link, txRef: payload.tx_ref };
}

// ===== FLUTTERWAVE WEBHOOK =====
exports.flutterwaveWebhook = async (req, res, next) => {
  try {
    // Signature verification (already done in webhook.middleware, double-check here)
    const hash = req.headers['verif-hash'];
    if (!hash || hash !== process.env.FLW_ENCRYPTION_KEY) {
      logger.warn(`Flutterwave webhook invalid hash from ${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { event, data } = req.body;
    logger.info(`Flutterwave webhook: event=${event} status=${data?.status} tx_ref=${data?.tx_ref}`);

    const payment = await findByRef('providerRef', data?.tx_ref);
    if (!payment) {
      logger.warn(`Flutterwave webhook: no payment for tx_ref ${data?.tx_ref}`);
      return res.json({ status: 'ok' });
    }

    if (event === 'charge.completed') {
      if (data.status === 'successful') {
        // ===== IDEMPOTENCY CHECK =====
        const idemKey = makeIdempotencyKey('flutterwave', String(data.id));
        const isNew   = await acquireIdempotencyLock(idemKey);
        if (!isNew) {
          logger.info(`Flutterwave duplicate webhook ignored: ${data.id}`);
          return res.json({ status: 'ok' });
        }
        await markPaid(payment.id, {
          transactionId: String(data.id),
          note: `Flutterwave payment confirmed. TX: ${data.tx_ref}, Ref: ${data.flw_ref}`,
          ip: req.ip,
        });
      } else if (data.status === 'failed') {
        await markFailed(payment.id, {
          reason: data.processor_response || 'Flutterwave payment failed',
          code: data.status, ip: req.ip,
        });
      }
    }

    res.json({ status: 'ok' });
  } catch (err) { logger.error('Flutterwave webhook error:', err); res.json({ status: 'ok' }); }
};

// ===== STRIPE =====
async function initiateStripe(order) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'usd', unit_amount: Math.round(order.total * 100),
      product_data: { name: `Hafa Market Order #${order.id.slice(-8).toUpperCase()}` } }, quantity: 1 }],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/order/success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/cart`,
    metadata: { orderId: order.id },
  });

  await prisma.payment.update({
    where: { orderId: order.id },
    data: { method: 'CARD', providerRef: session.id },
  });

  return { sessionId: session.id, url: session.url };
}

// ===== CHAPA PHONE FORMATTER =====
// Chapa requires 09xxxxxxxx or 07xxxxxxxx (10 digits, Ethiopian format)
function formatChapaPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  if (digits.length === 9) return '0' + digits;
  return '';
}

// ===== CHAPA (Ethiopia) =====
async function initiateChapa(order, channel = null) {
  const { CHAPA_SECRET_KEY } = process.env;
  if (!CHAPA_SECRET_KEY) throw new AppError('Chapa is not configured.', 503);

  const txRef = `HAFA-${order.id.slice(-8).toUpperCase()}-${Date.now()}`;

  const userEmail = process.env.NODE_ENV !== 'production'
    ? 'test@chapa.co'  // Chapa sandbox only accepts their test email
    : (order.user.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.user.email)
        ? order.user.email
        : `customer${order.user.id.replace(/-/g,'').slice(-8)}@hafamarket.com`);

  logger.info(`Chapa init: user=${order.user.id} email=${userEmail} amount=${order.total}`);

  const payload = {
    amount:        order.total.toFixed(2),
    currency:      'ETB',
    email:         userEmail,
    first_name:    order.user.name?.split(' ')[0] || 'Customer',
    last_name:     order.user.name?.split(' ').slice(1).join(' ') || 'User',
    phone_number:  formatChapaPhone(order.user.phone),
    tx_ref:        txRef,
    callback_url:  `${process.env.CLIENT_URL}/order/success?orderId=${order.id}`,
    return_url:    `${process.env.CLIENT_URL}/order/success?orderId=${order.id}`,
    customization: {
      title:       'Hafa Market',
      description: `Order ${order.id.slice(-8).toUpperCase()}`,
      logo:        `${process.env.CLIENT_URL}/logo.png`,
    },
  };

  // Add specific channel if provided (telebirr, cbebirr, etc.)
  if (channel) payload.payment_method = channel;

  const res = await fetch('https://api.chapa.co/v1/transaction/initialize', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${CHAPA_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  let data;
  try { data = JSON.parse(rawText); } catch { throw new AppError('Chapa returned invalid response.', 502); }

  if (data.status !== 'success') {
    const errMsg = typeof data.message === 'string' ? data.message
                 : data.message?.en || data.message?.am || JSON.stringify(data.message) || 'Unknown Chapa error';
    logger.error('Chapa init failed:', JSON.stringify(data));
    throw new AppError(`Chapa error: ${errMsg}`, 400);
  }

  await prisma.payment.update({
    where: { orderId: order.id },
    data:  { method: channel === 'telebirr' ? 'TELEBIRR' : channel === 'cbebirr' ? 'CBE_BIRR' : 'CHAPA',
             providerRef: txRef, chapaRef: txRef },
  });

  return { checkoutUrl: data.data.checkout_url, txRef };
}

// ===== CHAPA WEBHOOK =====
exports.chapaWebhook = async (req, res, next) => {
  try {
    // ===== SIGNATURE VERIFICATION =====
    const chapaSignature = req.headers['chapa-signature'] || req.headers['x-chapa-signature'];
    if (process.env.CHAPA_WEBHOOK_SECRET) {
      if (!chapaSignature) {
        logger.warn(`Chapa webhook missing signature from ${req.ip}`);
        return res.status(401).json({ error: 'Missing signature' });
      }
      const crypto   = require('crypto');
      const payload  = JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET)
                             .update(payload).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(chapaSignature), Buffer.from(expected))) {
        logger.warn(`Chapa webhook invalid signature from ${req.ip}`);
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { event, tx_ref, status } = req.body;
    logger.info(`Chapa webhook: event=${event} status=${status} tx_ref=${tx_ref}`);

    const payment = await findByRef('chapaRef', tx_ref);
    if (!payment) {
      logger.warn(`Chapa webhook: no payment found for tx_ref ${tx_ref}`);
      return res.json({ status: 'ok' });
    }

    // ===== STATUS HANDLING =====
    if (event === 'charge.success' || status === 'success') {
      // ===== IDEMPOTENCY CHECK =====
      const idemKey = makeIdempotencyKey('chapa', tx_ref);
      const isNew   = await acquireIdempotencyLock(idemKey);
      if (!isNew) {
        logger.info(`Chapa duplicate webhook ignored: ${tx_ref}`);
        return res.json({ status: 'ok' });
      }
      await markPaid(payment.id, {
        transactionId: tx_ref,
        note: `Chapa payment confirmed via webhook. TX: ${tx_ref}`,
        ip: req.ip,
      });
    } else if (event === 'charge.failed' || status === 'failed') {
      await markFailed(payment.id, {
        reason: req.body.message || 'Chapa payment failed',
        code: status, ip: req.ip,
      });
    } else {
      logger.info(`Chapa webhook: unhandled event=${event} status=${status}`);
    }

    res.json({ status: 'ok' });
  } catch (err) {
    logger.error('Chapa webhook error:', err);
    res.json({ status: 'ok' }); // always 200 to Chapa
  }
};

// ===== CHAPA VERIFY (called after redirect from Chapa checkout) =====
exports.chapaVerify = async (req, res, next) => {
  try {
    const { txRef } = req.params;
    const { CHAPA_SECRET_KEY } = process.env;
    if (!CHAPA_SECRET_KEY) throw new AppError('Chapa not configured.', 503);

    // Call Chapa verification API
    const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
      headers: { Authorization: `Bearer ${CHAPA_SECRET_KEY}` },
    });
    const data = await response.json();
    logger.info(`Chapa verify: txRef=${txRef} status=${data.data?.status}`);

    const payment = await findByRef('chapaRef', txRef);
    if (!payment) throw new AppError('Payment record not found.', 404);

    if (data.status === 'success' && data.data?.status === 'success') {
      // ===== PAYMENT SUCCESSFUL =====
      await markPaid(payment.id, {
        transactionId: txRef,
        note: `Chapa payment verified. TX: ${txRef}, Amount: ${data.data.amount} ${data.data.currency}`,
      });
      return res.json({
        success:  true,
        verified: true,
        message:  'Payment verified successfully.',
        data: {
          txRef,
          amount:   data.data.amount,
          currency: data.data.currency,
          status:   'PAID',
          orderId:  payment.orderId,
        },
      });
    } else {
      // ===== PAYMENT NOT SUCCESSFUL =====
      const chapaStatus = data.data?.status || 'unknown';
      if (chapaStatus === 'failed' || chapaStatus === 'abandoned') {
        await markFailed(payment.id, {
          reason: `Chapa verification: ${chapaStatus}`,
          code: chapaStatus,
        });
      }
      return res.json({
        success:  false,
        verified: false,
        message:  `Payment ${chapaStatus}. Please try again.`,
        data: { txRef, status: chapaStatus, orderId: payment.orderId },
      });
    }
  } catch (err) { next(err); }
};

// ===== PAYMENT ON DELIVERY: AGENT COLLECTS =====
exports.collectPaymentOnDelivery = async (req, res, next) => {
  try {
    const { orderId, amountCollected, notes } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.payment?.method !== 'PAYMENT_ON_DELIVERY') {
      throw new AppError('This order is not a payment-on-delivery order.', 400);
    }
    if (order.status !== 'OUT_FOR_DELIVERY' && order.status !== 'DELIVERED') {
      throw new AppError('Order must be out for delivery to collect payment.', 400);
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: { orderId },
        data:  { status: 'PAID', paidAt: new Date(), podCollected: true, podCollectedAt: new Date() },
      }),
      prisma.order.update({
        where: { id: orderId },
        data:  { status: 'DELIVERED', deliveredAt: new Date(),
                 statusHistory: { create: { status: 'DELIVERED',
                   note: `Payment collected on delivery. Amount: $${amountCollected}. ${notes || ''}` } } },
      }),
    ]);

    logger.info(`POD collected for order ${orderId} by agent ${req.user.id}`);
    res.json({ success: true, message: 'Payment collected and order marked as delivered.' });
  } catch (err) { next(err); }
};

// ===== STRIPE WEBHOOK =====
exports.stripeWebhook = async (req, res, next) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig    = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn(`Stripe webhook signature failed: ${err.message}`);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    logger.info(`Stripe webhook: type=${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const payment = await findByRef('providerRef', session.id);
        if (payment) {
          await markPaid(payment.id, {
            transactionId: session.payment_intent,
            note: `Stripe checkout completed. Session: ${session.id}`,
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent  = event.data.object;
        const payment = await findByRef('transactionId', intent.id);
        if (payment) {
          await markFailed(payment.id, {
            reason: intent.last_payment_error?.message || 'Stripe payment failed',
            code:   intent.last_payment_error?.code,
          });
        }
        break;
      }
      case 'charge.refunded': {
        const charge  = event.data.object;
        const payment = await findByRef('transactionId', charge.payment_intent);
        if (payment) {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
          await prisma.order.update({ where: { id: payment.orderId },
            data: { status: 'REFUNDED',
                    statusHistory: { create: { status: 'REFUNDED', note: 'Stripe refund processed' } } } });
        }
        break;
      }
      default:
        logger.debug(`Stripe webhook unhandled event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) { next(err); }
};

// ===== REFUND =====
exports.refundPayment = async (req, res, next) => {
  try {
    const { orderId, reason } = req.body;
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment) throw new AppError('Payment not found.', 404);
    if (payment.status !== 'PAID') throw new AppError('Payment is not eligible for refund.', 400);

    if (payment.method === 'CARD' && payment.transactionId) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      await stripe.refunds.create({ payment_intent: payment.transactionId });
    }

    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'REFUNDED',
              statusHistory: { create: { status: 'REFUNDED', note: reason || 'Refund processed' } } },
    });

    res.json({ success: true, message: 'Refund processed successfully.' });
  } catch (err) { next(err); }
};

// ===== SELLER PAYOUT =====
exports.requestPayout = async (req, res, next) => {
  try {
    const { amount, method, accountRef } = req.body;
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
    if (!seller) throw new AppError('Seller account not found.', 404);
    if (amount > seller.totalRevenue) throw new AppError('Insufficient balance.', 400);
    if (amount < 1) throw new AppError('Minimum payout is $1.', 400);

    const payout = await prisma.payout.create({
      data: { sellerId: seller.id, amount, method, accountRef, status: 'PENDING' },
    });

    // Auto-process M-Pesa B2C if credentials available
    if (method === 'MPESA' && process.env.MPESA_CONSUMER_KEY) {
      try {
        await disburseMpesaB2C({ phone: accountRef, amount, reference: payout.id });
        await prisma.payout.update({ where: { id: payout.id }, data: { status: 'PROCESSING' } });
      } catch (mpesaErr) {
        logger.warn(`M-Pesa B2C failed for payout ${payout.id}: ${mpesaErr.message}`);
        // Keep as PENDING for manual processing
      }
    }

    res.status(201).json({ success: true, data: payout });
  } catch (err) { next(err); }
};

async function disburseMpesaB2C({ phone, amount, reference }) {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_B2C_INITIATOR,
          MPESA_B2C_CREDENTIAL, MPESA_B2C_CALLBACK_URL } = process.env;

  // Get token
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${auth}` },
  });
  const { access_token } = await tokenRes.json();

  const cleanPhone = phone.replace(/^\+/, '').replace(/^0/, '254');

  const res = await fetch('https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      InitiatorName:      MPESA_B2C_INITIATOR || 'testapi',
      SecurityCredential: MPESA_B2C_CREDENTIAL || '',
      CommandID:          'BusinessPayment',
      Amount:             Math.ceil(amount),
      PartyA:             MPESA_SHORTCODE,
      PartyB:             cleanPhone,
      Remarks:            `Hafa Market payout ${reference}`,
      QueueTimeOutURL:    MPESA_B2C_CALLBACK_URL || 'https://yourdomain.com/api/v1/payments/mpesa/b2c/timeout',
      ResultURL:          MPESA_B2C_CALLBACK_URL || 'https://yourdomain.com/api/v1/payments/mpesa/b2c/result',
      Occasion:           'SellerPayout',
    }),
  });

  const data = await res.json();
  if (data.ResponseCode !== '0') throw new Error(data.ResponseDescription);
  return data;
}

exports.getPaymentStatus = async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { orderId: req.params.orderId },
      include: { order: { select: { status: true, total: true, id: true } } },
    });
    if (!payment) throw new AppError('Payment not found.', 404);

    // Only allow the order owner or admin
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (order?.userId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized.', 403);
    }

    res.json({
      success: true,
      data: {
        id:           payment.id,
        status:       payment.status,
        method:       payment.method,
        amount:       payment.amount,
        currency:     payment.currency,
        paidAt:       payment.paidAt,
        failureReason:payment.failureReason,
        transactionId:payment.transactionId,
        chapaRef:     payment.chapaRef,
        mpesaCode:    payment.mpesaCode,
        canRetry:     payment.status === 'FAILED' || payment.status === 'PENDING',
        orderStatus:  payment.order?.status,
      },
    });
  } catch (err) { next(err); }
};

// ===== RETRY FAILED PAYMENT =====
exports.retryPayment = async (req, res, next) => {
  try {
    const { orderId, method } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, user: true },
    });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== req.user.id) throw new AppError('Not authorized.', 403);
    if (order.payment?.status === 'PAID') throw new AppError('Order already paid.', 400);
    if (!['PENDING','FAILED'].includes(order.status)) {
      throw new AppError('Order cannot be retried in its current state.', 400);
    }

    // Reset payment to pending
    await prisma.payment.update({
      where: { orderId },
      data: { status: 'PENDING', failureReason: null, method: method || order.payment.method },
    });

    // Re-initiate — reuse initiatePayment logic
    req.body.orderId = orderId;
    req.body.method  = method || order.payment.method;
    return exports.initiatePayment(req, res, next);
  } catch (err) { next(err); }
};

// ===== M-PESA B2C RESULT CALLBACK =====
exports.mpesaB2cResult = async (req, res, next) => {
  try {
    const result = req.body?.Result;
    if (!result) return res.json({ ResultCode: 0 });

    const ref = result.OriginatorConversationID;
    const payout = await prisma.payout.findFirst({ where: { id: { contains: ref } } });

    if (payout) {
      const status = result.ResultCode === 0 ? 'COMPLETED' : 'FAILED';
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status, processedAt: new Date(),
                notes: result.ResultDesc },
      });
      if (status === 'COMPLETED') {
        await prisma.seller.update({
          where: { id: payout.sellerId },
          data: { totalRevenue: { decrement: payout.amount } },
        });
      }
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) { logger.error('M-Pesa B2C result error:', err); res.json({ ResultCode: 0 }); }
};

