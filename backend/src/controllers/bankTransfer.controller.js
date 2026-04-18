'use strict';
const crypto  = require('crypto');
const prisma  = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const logger  = require('../config/logger');
const { markPaid, markFailed, logPaymentEvent } = require('../services/payment.service');
const { audit, AUDIT_ACTIONS } = require('../services/audit.service');
const { createNotification } = require('../services/notification.service');
const { dispatchEmail } = require('../jobs/queues');

// ===== BANK TRANSFER EXPIRY =====
const TRANSFER_EXPIRY_HOURS = 24;

// ===== HAFA MARKET BANK ACCOUNTS =====
const HAFA_BANK_ACCOUNTS = [
  { id:'cbe',       bankName:'Commercial Bank of Ethiopia (CBE)', bankCode:'CBE',       accountName:'Hafa Market PLC', accountNumber:'1000123456789', swiftCode:'CBETETAA', currency:'ETB' },
  { id:'awash',     bankName:'Awash Bank',                        bankCode:'AWASH',     accountName:'Hafa Market PLC', accountNumber:'0123456789012', swiftCode:'AWINETAA', currency:'ETB' },
  { id:'dashen',    bankName:'Dashen Bank',                       bankCode:'DASHEN',    accountName:'Hafa Market PLC', accountNumber:'0001234567890', swiftCode:'DASHETAA', currency:'ETB' },
  { id:'abyssinia', bankName:'Bank of Abyssinia',                 bankCode:'BOA',       accountName:'Hafa Market PLC', accountNumber:'0012345678901', swiftCode:'ABYSETAA', currency:'ETB' },
  { id:'equity_ke', bankName:'Equity Bank Kenya',                 bankCode:'EQUITY_KE', accountName:'Hafa Market Ltd', accountNumber:'0123456789',    swiftCode:'EQBLKENA', currency:'KES' },
  { id:'kcb_ke',    bankName:'KCB Bank Kenya',                    bankCode:'KCB_KE',    accountName:'Hafa Market Ltd', accountNumber:'1234567890',    swiftCode:'KCBLKENX', currency:'KES' },
];

// ===== REFERENCE CODE VALIDATION =====
const REF_PATTERN = /^HAFA-[A-Z0-9]{6}-[A-Z0-9]{6,}$/;

// ===== BANK TX ID PATTERNS (per bank) =====
const BANK_TX_PATTERNS = {
  CBE:       /^ETB\d{10,}$/i,
  AWASH:     /^AWB\d{8,}$/i,
  DASHEN:    /^DSH\d{8,}$/i,
  BOA:       /^BOA\d{8,}$/i,
  EQUITY_KE: /^EQB\d{8,}$/i,
  KCB_KE:    /^KCB\d{8,}$/i,
  DEFAULT:   /^[A-Z0-9]{6,30}$/i,
};

// ===== FRAUD DETECTION =====
async function detectFraud(transfer, submission) {
  const flags = [];

  // 1. Duplicate bank transaction ID
  if (submission.senderBankTxId) {
    const existing = await prisma.bankTransfer.findFirst({
      where: { senderBankTxId: submission.senderBankTxId, id: { not: transfer.id } },
    });
    if (existing) flags.push('DUPLICATE_BANK_TX_ID');
  }

  // 2. Multiple submissions from same sender account
  if (submission.senderAccount) {
    const senderCount = await prisma.bankTransfer.count({
      where: { senderAccount: submission.senderAccount, status: { in: ['SUBMITTED','VERIFIED'] },
               id: { not: transfer.id } },
    });
    if (senderCount >= 3) flags.push('HIGH_FREQUENCY_SENDER');
  }

  // 3. Transfer date in the future
  if (submission.transferDate && new Date(submission.transferDate) > new Date()) {
    flags.push('FUTURE_TRANSFER_DATE');
  }

  // 4. Transfer date too old (> 3 days)
  if (submission.transferDate) {
    const daysDiff = (Date.now() - new Date(submission.transferDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 3) flags.push('OLD_TRANSFER_DATE');
  }

  // 5. Bank TX ID format validation
  if (submission.senderBankTxId && transfer.bankName) {
    const bankCode = HAFA_BANK_ACCOUNTS.find(b => b.bankName === transfer.bankName)?.bankCode;
    const pattern  = BANK_TX_PATTERNS[bankCode] || BANK_TX_PATTERNS.DEFAULT;
    if (!pattern.test(submission.senderBankTxId)) flags.push('INVALID_TX_ID_FORMAT');
  }

  return flags;
}

// ===== AUTO-MATCH SCORE =====
function calculateMatchScore(transfer, submission) {
  let score = 0;
  const checks = [];

  // Amount match (most important — 40 points)
  if (submission.amount && Math.abs(parseFloat(submission.amount) - transfer.amount) < 0.01) {
    score += 40; checks.push('amount_match');
  }

  // Reference code in notes (30 points)
  if (submission.notes?.includes(transfer.referenceCode)) {
    score += 30; checks.push('reference_in_notes');
  }

  // Sender bank TX ID provided (15 points)
  if (submission.senderBankTxId) {
    score += 15; checks.push('tx_id_provided');
  }

  // Transfer date within 24h of initiation (10 points)
  if (submission.transferDate) {
    const diff = Math.abs(new Date(submission.transferDate) - new Date(transfer.createdAt));
    if (diff < 24 * 60 * 60 * 1000) { score += 10; checks.push('date_match'); }
  }

  // Proof image provided (5 points)
  if (submission.proofImageUrl) {
    score += 5; checks.push('proof_provided');
  }

  return { score, checks, autoApprove: score >= 85 };
}

// ===== GET BANK ACCOUNTS =====
exports.getBankAccounts = async (req, res) => {
  const { currency } = req.query;
  const accounts = currency
    ? HAFA_BANK_ACCOUNTS.filter(b => b.currency === currency.toUpperCase())
    : HAFA_BANK_ACCOUNTS;
  res.json({ success: true, data: accounts });
};

// ===== INITIATE BANK TRANSFER =====
exports.initiateBankTransfer = async (req, res, next) => {
  try {
    const { orderId, bankCode, currency = 'ETB' } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, user: { select: { id:true, name:true, email:true } } },
    });
    if (!order)                           throw new AppError('Order not found.', 404);
    if (order.userId !== req.user.id)     throw new AppError('Not authorized.', 403);
    if (order.payment?.status === 'PAID') throw new AppError('Order already paid.', 409);

    const bank = HAFA_BANK_ACCOUNTS.find(b => b.bankCode === bankCode);
    if (!bank) throw new AppError(`Bank "${bankCode}" not supported. Available: ${HAFA_BANK_ACCOUNTS.map(b => b.bankCode).join(', ')}`, 400);

    const referenceCode = `HAFA-${order.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt     = new Date(Date.now() + TRANSFER_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.payment.update({
      where: { orderId },
      data: { method: 'BANK_TRANSFER', status: 'PENDING', expiresAt },
    });

    const transfer = await prisma.bankTransfer.upsert({
      where: { paymentId: order.payment.id },
      update: { bankName: bank.bankName, accountName: bank.accountName,
                accountNumber: bank.accountNumber, referenceCode, amount: order.total,
                currency, status: 'PENDING', expiresAt, fraudFlags: [] },
      create: { paymentId: order.payment.id, bankName: bank.bankName,
                accountName: bank.accountName, accountNumber: bank.accountNumber,
                referenceCode, amount: order.total, currency, expiresAt, fraudFlags: [] },
    });

    await logPaymentEvent(order.payment.id, 'BANK_TRANSFER_INITIATED', 'PENDING',
      { bankCode, referenceCode, expiresAt }, req.ip);

    logger.info(`Bank transfer initiated: order=${orderId} ref=${referenceCode} bank=${bankCode}`);

    res.json({
      success: true,
      data: {
        referenceCode,
        expiresAt,
        expiresIn: `${TRANSFER_EXPIRY_HOURS} hours`,
        instructions: {
          step1: `Transfer exactly ${currency} ${order.total.toFixed(2)} to the account below`,
          step2: `Use reference code "${referenceCode}" as your transfer description/narration`,
          step3: 'Submit your transfer proof using POST /api/v1/bank-transfers/submit-proof',
          step4: 'Your order will be confirmed within 1–2 business hours after verification',
          warning: `⚠️ This transfer expires in ${TRANSFER_EXPIRY_HOURS} hours. Transfer must be completed before ${expiresAt.toLocaleString()}.`,
        },
        bankDetails: {
          bankName:      bank.bankName,
          accountName:   bank.accountName,
          accountNumber: bank.accountNumber,
          swiftCode:     bank.swiftCode,
          currency,
          amount:        order.total.toFixed(2),
          reference:     referenceCode,
        },
        transferId: transfer.id,
      },
    });
  } catch (err) { next(err); }
};

// ===== SUBMIT TRANSFER PROOF =====
exports.submitTransferProof = async (req, res, next) => {
  try {
    const { referenceCode, senderName, senderAccount, senderBankTxId,
            transferDate, proofImageUrl, notes, amount } = req.body;

    // ===== VALIDATE REFERENCE FORMAT =====
    if (!REF_PATTERN.test(referenceCode)) {
      throw new AppError('Invalid reference code format. Must be HAFA-XXXXXX-XXXXXX.', 400);
    }

    const transfer = await prisma.bankTransfer.findUnique({
      where: { referenceCode },
      include: { payment: { include: { order: { include: { user: { select: { id:true, name:true, email:true } } } } } } },
    });
    if (!transfer) throw new AppError('Transfer reference not found.', 404);
    if (transfer.status === 'VERIFIED') throw new AppError('Transfer already verified.', 400);
    if (transfer.status === 'REJECTED') throw new AppError('This transfer was rejected. Please initiate a new transfer.', 400);

    // ===== EXPIRY CHECK =====
    if (transfer.expiresAt && transfer.expiresAt < new Date()) {
      throw new AppError(`Transfer expired at ${transfer.expiresAt.toLocaleString()}. Please initiate a new bank transfer.`, 410);
    }

    // ===== DUPLICATE SUBMISSION LIMIT =====
    if (transfer.submissionCount >= 3) {
      throw new AppError('Maximum submission attempts reached (3). Please contact support.', 429);
    }

    // ===== DUPLICATE BANK TX ID CHECK =====
    if (senderBankTxId) {
      const dupTx = await prisma.bankTransfer.findFirst({
        where: { senderBankTxId, id: { not: transfer.id } },
      });
      if (dupTx) {
        await prisma.bankTransfer.update({
          where: { id: transfer.id },
          data: { fraudFlags: { push: 'DUPLICATE_BANK_TX_ID' } },
        });
        await logPaymentEvent(transfer.paymentId, 'FRAUD_DUPLICATE_TX_ID', 'PENDING',
          { senderBankTxId, existingTransferId: dupTx.id }, req.ip);
        throw new AppError('This bank transaction ID has already been used. Please contact support if this is an error.', 409);
      }
    }

    // ===== FRAUD DETECTION =====
    const fraudFlags = await detectFraud(transfer, { senderBankTxId, senderAccount, transferDate, notes });

    // ===== AUTO-MATCH SCORING =====
    const matchResult = calculateMatchScore(transfer, { amount, senderBankTxId, transferDate, notes, proofImageUrl });

    const updated = await prisma.bankTransfer.update({
      where: { referenceCode },
      data: {
        senderName,
        senderAccount,
        senderBankTxId,
        transferDate:    transferDate ? new Date(transferDate) : null,
        proofImageUrl,
        notes,
        status:          'SUBMITTED',
        submissionCount: { increment: 1 },
        lastSubmittedAt: new Date(),
        fraudFlags:      { push: fraudFlags },
        autoMatchScore:  matchResult.score,
        autoMatchData:   matchResult,
      },
    });

    await logPaymentEvent(transfer.paymentId, 'PROOF_SUBMITTED', 'PENDING',
      { senderBankTxId, matchScore: matchResult.score, fraudFlags }, req.ip);

    // ===== AUTO-APPROVE if score >= 85 and no fraud flags =====
    if (matchResult.autoApprove && fraudFlags.length === 0) {
      logger.info(`Auto-approving transfer ${referenceCode} (score: ${matchResult.score})`);
      await autoApproveTransfer(transfer, req.user?.id || 'system');
      return res.json({
        success: true,
        message: '✅ Transfer automatically verified! Your order is confirmed.',
        data: { referenceCode, status: 'VERIFIED', autoApproved: true },
      });
    }

    // Notify user
    const user = transfer.payment.order.user;
    createNotification(user.id, 'SYSTEM', 'Payment Under Review 🔍',
      'Your bank transfer proof has been received. Verification usually takes 5–30 minutes.',
      { referenceCode }).catch(() => {});

    // Notify admin if fraud flags
    if (fraudFlags.length > 0) {
      logger.warn(`⚠️ Fraud flags on transfer ${referenceCode}: ${fraudFlags.join(', ')}`);
    }

    res.json({
      success: true,
      message: fraudFlags.length > 0
        ? '⚠️ Proof submitted but flagged for manual review. Our team will verify within 1–2 hours.'
        : '✅ Proof submitted. Your payment is under review (usually 5–30 minutes).',
      data: {
        referenceCode,
        status:      'SUBMITTED',
        matchScore:  matchResult.score,
        fraudFlags:  fraudFlags.length > 0 ? fraudFlags : undefined,
        transferId:  updated.id,
      },
    });
  } catch (err) { next(err); }
};

// ===== AUTO-APPROVE HELPER =====
async function autoApproveTransfer(transfer, verifiedBy) {
  await prisma.bankTransfer.update({
    where: { id: transfer.id },
    data: { status: 'VERIFIED', verifiedBy, verifiedAt: new Date(), notes: 'Auto-approved by system' },
  });
  await markPaid(transfer.paymentId, {
    transactionId: transfer.referenceCode,
    note: `Bank transfer auto-verified. Ref: ${transfer.referenceCode}. Score: ${transfer.autoMatchScore}`,
  });
}

// ===== ADMIN: GET PENDING TRANSFERS =====
exports.getPendingTransfers = async (req, res, next) => {
  try {
    const { status = 'SUBMITTED', page = 1, limit = 20 } = req.query;
    const [transfers, total] = await Promise.all([
      prisma.bankTransfer.findMany({
        where: { status },
        skip: (parseInt(page)-1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: [{ fraudFlags: 'asc' }, { createdAt: 'asc' }], // clean ones first
        include: {
          payment: {
            include: {
              order: {
                include: {
                  user:    { select: { name:true, email:true, phone:true } },
                  address: { select: { city:true, country:true } },
                  items:   { select: { productName:true, quantity:true, unitPrice:true } },
                },
              },
            },
          },
        },
      }),
      prisma.bankTransfer.count({ where: { status } }),
    ]);

    // Enrich with admin decision context
    const enriched = transfers.map(t => ({
      ...t,
      adminContext: {
        riskLevel:    t.fraudFlags?.length > 0 ? 'HIGH' : t.autoMatchScore >= 70 ? 'LOW' : 'MEDIUM',
        recommendation: t.autoMatchScore >= 85 && !t.fraudFlags?.length ? 'APPROVE'
                      : t.fraudFlags?.length > 0 ? 'REVIEW_CAREFULLY' : 'VERIFY',
        checkList: [
          { item: 'Amount matches order total', done: Math.abs(t.amount - t.payment?.order?.total) < 0.01 },
          { item: 'Reference code in notes',    done: t.notes?.includes(t.referenceCode) },
          { item: 'Bank TX ID provided',        done: !!t.senderBankTxId },
          { item: 'Proof image uploaded',       done: !!t.proofImageUrl },
          { item: 'No fraud flags',             done: !t.fraudFlags?.length },
        ],
      },
    }));

    res.json({ success:true, data:enriched,
      pagination: { page:parseInt(page), limit:parseInt(limit), total, pages:Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
};

// ===== ADMIN: VERIFY TRANSFER =====
exports.verifyTransfer = async (req, res, next) => {
  try {
    const { referenceCode, action, notes } = req.body;
    if (!['approve','reject'].includes(action)) throw new AppError('Action must be "approve" or "reject".', 400);

    const transfer = await prisma.bankTransfer.findUnique({
      where: { referenceCode },
      include: { payment: { include: { order: { include: { user: { select: { id:true, name:true, email:true } } } } } } },
    });
    if (!transfer) throw new AppError('Transfer not found.', 404);
    if (transfer.status === 'VERIFIED') throw new AppError('Already verified.', 400);

    const user = transfer.payment.order.user;

    if (action === 'approve') {
      await prisma.bankTransfer.update({
        where: { referenceCode },
        data: { status: 'VERIFIED', verifiedBy: req.user.id, verifiedAt: new Date(), notes },
      });
      await markPaid(transfer.paymentId, {
        transactionId: referenceCode,
        note: `Bank transfer verified by admin ${req.user.id}. Ref: ${referenceCode}. ${notes || ''}`,
        ip: req.ip,
      });

      // Notify buyer
      createNotification(user.id, 'PAYMENT_SUCCESS', 'Payment Confirmed ✅',
        'Your bank transfer has been verified. Your order is now being processed!',
        { referenceCode, orderId: transfer.payment.orderId }).catch(() => {});

      dispatchEmail('BANK_TRANSFER_APPROVED', {
        type: 'BANK_TRANSFER_APPROVED',
        data: { name: user.name, email: user.email, referenceCode,
                orderId: transfer.payment.orderId.slice(-8).toUpperCase() },
      }).catch(() => {});

      audit(AUDIT_ACTIONS.PAYMENT_SUCCESS, {
        userId: req.user.id, targetId: transfer.paymentId, targetType: 'Payment',
        meta: { action: 'bank_transfer_approved', referenceCode, notes },
      });

      await logPaymentEvent(transfer.paymentId, 'ADMIN_APPROVED', 'PAID',
        { adminId: req.user.id, referenceCode, notes }, req.ip);

      logger.info(`✅ Bank transfer APPROVED: ref=${referenceCode} by admin ${req.user.id}`);
      res.json({ success: true, message: `Transfer ${referenceCode} approved. Order confirmed.` });

    } else {
      await prisma.bankTransfer.update({
        where: { referenceCode },
        data: { status: 'REJECTED', verifiedBy: req.user.id, verifiedAt: new Date(),
                rejectionReason: notes },
      });
      await markFailed(transfer.paymentId, {
        reason: `Bank transfer rejected: ${notes || 'Could not verify transfer'}`,
        code: 'BANK_TRANSFER_REJECTED', ip: req.ip,
      });

      // Notify buyer with clear reason
      createNotification(user.id, 'PAYMENT_FAILED', 'Payment Could Not Be Verified ❌',
        `Your bank transfer could not be verified. Reason: ${notes || 'Please contact support'}. You can retry with a new transfer.`,
        { referenceCode, orderId: transfer.payment.orderId }).catch(() => {});

      audit('BANK_TRANSFER_REJECTED', {
        userId: req.user.id, targetId: transfer.paymentId, targetType: 'Payment',
        meta: { referenceCode, notes },
      });

      await logPaymentEvent(transfer.paymentId, 'ADMIN_REJECTED', 'FAILED',
        { adminId: req.user.id, referenceCode, reason: notes }, req.ip);

      logger.info(`❌ Bank transfer REJECTED: ref=${referenceCode} by admin ${req.user.id}`);
      res.json({ success: true, message: `Transfer ${referenceCode} rejected. Buyer notified.` });
    }
  } catch (err) { next(err); }
};

// ===== GET TRANSFER STATUS (buyer) =====
exports.getTransferStatus = async (req, res, next) => {
  try {
    const { referenceCode } = req.params;
    const transfer = await prisma.bankTransfer.findUnique({
      where: { referenceCode },
      include: { payment: { select: { status:true, orderId:true, expiresAt:true } } },
    });
    if (!transfer) throw new AppError('Transfer reference not found.', 404);

    const isExpired = transfer.expiresAt && transfer.expiresAt < new Date();

    res.json({
      success: true,
      data: {
        referenceCode:  transfer.referenceCode,
        status:         isExpired && transfer.status === 'PENDING' ? 'EXPIRED' : transfer.status,
        bankName:       transfer.bankName,
        amount:         transfer.amount,
        currency:       transfer.currency,
        expiresAt:      transfer.expiresAt,
        isExpired,
        submittedAt:    transfer.lastSubmittedAt,
        verifiedAt:     transfer.verifiedAt,
        paymentStatus:  transfer.payment?.status,
        orderId:        transfer.payment?.orderId,
        canResubmit:    transfer.status === 'SUBMITTED' && transfer.submissionCount < 3 && !isExpired,
        message: {
          PENDING:   '⏳ Waiting for your transfer proof. Please submit your receipt.',
          SUBMITTED: '🔍 Proof received. Verification in progress (usually 5–30 minutes).',
          VERIFIED:  '✅ Transfer verified! Your order is confirmed.',
          REJECTED:  `❌ Transfer rejected. Reason: ${transfer.rejectionReason || 'Contact support'}. Please retry.`,
          EXPIRED:   '⏰ Transfer expired. Please initiate a new bank transfer.',
        }[isExpired ? 'EXPIRED' : transfer.status] || 'Unknown status',
      },
    });
  } catch (err) { next(err); }
};

// ===== AUTO-EXPIRE TRANSFERS (called by cron job) =====
exports.expireTransfers = async (req, res, next) => {
  try {
    const expired = await prisma.bankTransfer.findMany({
      where: { status: { in: ['PENDING','SUBMITTED'] }, expiresAt: { lt: new Date() } },
    });

    let count = 0;
    for (const t of expired) {
      await prisma.bankTransfer.update({ where: { id: t.id }, data: { status: 'EXPIRED' } });
      await markFailed(t.paymentId, { reason: 'Bank transfer expired', code: 'EXPIRED' });
      count++;
    }

    logger.info(`Expired ${count} bank transfers`);
    res.json({ success: true, message: `Expired ${count} transfers.` });
  } catch (err) { next(err); }
};

// ===== CHAPA BANK TRANSFER =====
exports.initiateChapaBank = async (req, res, next) => {
  try {
    const { orderId, bankCode, accountNumber } = req.body;
    const { CHAPA_SECRET_KEY } = process.env;
    if (!CHAPA_SECRET_KEY) throw new AppError('Chapa not configured.', 503);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, user: true },
    });
    if (!order)                           throw new AppError('Order not found.', 404);
    if (order.userId !== req.user.id)     throw new AppError('Not authorized.', 403);
    if (order.payment?.status === 'PAID') throw new AppError('Order already paid.', 409);

    const txRef = `HAFA-BANK-${order.id.slice(-8).toUpperCase()}-${Date.now()}`;
    const userEmail = process.env.NODE_ENV !== 'production' ? 'test@chapa.co'
      : (order.user.email || `customer${order.user.id.slice(-8)}@hafamarket.com`);

    const payload = {
      amount: order.total.toFixed(2), currency: 'ETB', email: userEmail,
      first_name: order.user.name?.split(' ')[0] || 'Customer',
      last_name:  order.user.name?.split(' ').slice(1).join(' ') || 'User',
      tx_ref: txRef,
      callback_url: `${process.env.CLIENT_URL}/order/success?orderId=${order.id}`,
      return_url:   `${process.env.CLIENT_URL}/order/success?orderId=${order.id}`,
      payment_method: 'bank_transfer',
      bank_code: bankCode,
      account_number: accountNumber,
      customization: { title: 'Hafa Market', description: `Order ${order.id.slice(-8).toUpperCase()}` },
    };

    const initRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CHAPA_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const rawText = await initRes.text();
    let data;
    try { data = JSON.parse(rawText); } catch { throw new AppError('Chapa returned invalid response.', 502); }

    if (data.status !== 'success') {
      const msg = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
      throw new AppError(`Chapa bank error: ${msg}`, 400);
    }

    await prisma.payment.update({
      where: { orderId },
      data: { method: 'CHAPA_BANK', providerRef: txRef, chapaRef: txRef },
    });

    res.json({ success: true, data: { checkoutUrl: data.data.checkout_url, txRef } });
  } catch (err) { next(err); }
};

// ===== GET CHAPA SUPPORTED BANKS =====
exports.getChapabanks = async (req, res, next) => {
  try {
    const { CHAPA_SECRET_KEY } = process.env;
    if (!CHAPA_SECRET_KEY) throw new AppError('Chapa not configured.', 503);
    const response = await fetch('https://api.chapa.co/v1/banks', {
      headers: { Authorization: `Bearer ${CHAPA_SECRET_KEY}` },
    });
    const data = await response.json();
    res.json({ success: true, data: data.data || [] });
  } catch (err) { next(err); }
};
