const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { sendEmail: sendEmailService, sendPasswordReset } = require('../services/email.service');
const emailService = require('../services/email.service');
const { sendSMS } = require('../services/sms.service');
const { audit, AUDIT_ACTIONS } = require('../services/audit.service');
const logger = require('../config/logger');

// ===== TOKEN HELPERS =====
const signAccess = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
const signRefresh = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });

const sendTokens = async (user, statusCode, res, req) => {
  const accessToken  = signAccess(user.id);
  const refreshToken = signRefresh(user.id) + '.' + Date.now(); // ensure uniqueness

  // Device fingerprint from request headers
  const userAgent = req?.headers?.['user-agent'] || 'unknown';
  const ip        = req?.ip || req?.connection?.remoteAddress || 'unknown';
  const deviceId  = req?.headers?.['x-device-id'] || null;

  // Limit to 5 active sessions per user — remove oldest if exceeded
  const existingTokens = await prisma.refreshToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });
  if (existingTokens.length >= 5) {
    await prisma.refreshToken.delete({ where: { id: existingTokens[0].id } });
  }

  await prisma.refreshToken.create({
    data: {
      userId:    user.id,
      token:     refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent,
      ip,
      deviceId,
    },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   30 * 24 * 60 * 60 * 1000,
  });

  const { passwordHash, ...userData } = user;

  // Include seller profile so the dashboard knows the seller ID immediately after login
  let sellerData = null;
  if (user.role === 'SELLER' || user.role === 'ADMIN') {
    sellerData = await prisma.seller.findUnique({
      where: { userId: user.id },
      select: { id: true, storeName: true, storeSlug: true, status: true },
    }).catch(() => null);
  }

  res.status(statusCode).json({
    success: true,
    accessToken,
    user: { ...userData, seller: sellerData },
  });
};

// ===== REGISTER =====
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!email && !phone) throw new AppError('Email or phone number is required.', 400);

    const exists = await prisma.user.findFirst({
      where: { OR: [email ? { email } : {}, phone ? { phone } : {}] },
    });
    if (exists) throw new AppError('An account with this email or phone already exists.', 409);

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash, role: role === 'SELLER' ? 'SELLER' : 'BUYER' },
    });

    await sendTokens(user, 201, res, req);

    // Send welcome email (fire-and-forget — don't block registration)
    if (user.email) {
      emailService.sendWelcome(user).catch(err =>
        logger.warn(`Welcome email failed for ${user.email}: ${err.message}`)
      );
    }

    audit(AUDIT_ACTIONS.USER_REGISTER, { userId: user.id, meta: { email, phone, role } });
  } catch (err) { next(err); }
};

// ===== LOGIN =====
exports.login = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;
    if (!password) throw new AppError('Password is required.', 400);

    const user = await prisma.user.findFirst({
      where: { OR: [email ? { email } : {}, phone ? { phone } : {}] },
    });
    if (!user || !user.passwordHash) throw new AppError('Invalid credentials.', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid credentials.', 401);
    if (!user.isActive) throw new AppError('Account deactivated. Contact support.', 403);

    await sendTokens(user, 200, res, req);
    audit(AUDIT_ACTIONS.USER_LOGIN, { userId: user.id, meta: { method: email ? 'email' : 'phone' } });
  } catch (err) { next(err); }
};

// ===== REFRESH TOKEN =====
exports.refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) throw new AppError('No refresh token provided.', 401);

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.userId !== decoded.id) throw new AppError('Invalid refresh token.', 401);
    if (stored.expiresAt < new Date()) throw new AppError('Refresh token expired.', 401);

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) throw new AppError('User not found.', 401);

    // Rotate token
    await prisma.refreshToken.delete({ where: { token } });
    await sendTokens(user, 200, res, req);
  } catch (err) { next(err); }
};

// ===== LOGOUT =====
exports.logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) await prisma.refreshToken.deleteMany({ where: { token } });
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) { next(err); }
};

// ===== SEND OTP =====
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone, type = 'VERIFY_PHONE' } = req.body;
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw new AppError('No account found with this phone number.', 404);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.otpCode.create({
      data: { userId: user.id, code, type, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    await sendSMS(phone, `Your Hafa Market verification code is: ${code}. Valid for 10 minutes.`);
    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) { next(err); }
};

// ===== FORGOT PASSWORD =====
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) throw new AppError('Email or phone is required.', 400);

    const user = await prisma.user.findFirst({
      where: email ? { email } : { phone },
    });

    // Always return success to prevent user enumeration
    if (!user) return res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing unused PASSWORD_RESET codes for this user first
    await prisma.otpCode.deleteMany({
      where: { userId: user.id, type: 'PASSWORD_RESET', used: false },
    });

    await prisma.otpCode.create({
      data: { userId: user.id, code, type: 'PASSWORD_RESET', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });

    // Send via email or SMS
    if (email && user.email) {
      try {
        await emailService.sendPasswordReset(user, code);
      } catch (emailErr) {
        logger.error(`Password reset email failed for ${email}:`, emailErr.message);
        // Still return success — code is saved in DB, user can contact support
        // But in dev, throw so we can debug
        if (process.env.NODE_ENV !== 'production') {
          throw new AppError(`Email sending failed: ${emailErr.message}. Check EMAIL_PASS in .env`, 500);
        }
      }
    } else if (phone && user.phone) {
      await sendSMS(user.phone, `Your Hafa Market password reset code is: ${code}. Valid for 10 minutes.`);
    }

    res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });
  } catch (err) { next(err); }
};

// ===== RESET PASSWORD =====
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, phone, code, newPassword } = req.body;
    if (!code || !newPassword) throw new AppError('Code and new password are required.', 400);

    const user = await prisma.user.findFirst({
      where: email ? { email } : { phone },
    });
    if (!user) throw new AppError('Invalid reset request.', 400);

    // Find the OTP — check used:false and correct code first, then check expiry separately for better error message
    const otp = await prisma.otpCode.findFirst({
      where: { userId: user.id, code, type: 'PASSWORD_RESET', used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new AppError('Invalid reset code. Please request a new one.', 400);
    if (otp.expiresAt < new Date()) throw new AppError('Reset code has expired. Please request a new one.', 400);

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } }),
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) { next(err); }
};

// ===== VERIFY OTP =====
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw new AppError('User not found.', 404);

    const otp = await prisma.otpCode.findFirst({
      where: { userId: user.id, code, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new AppError('Invalid or expired OTP.', 400);

    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });

    await sendTokens(user, 200, res, req);
  } catch (err) { next(err); }
};

// ===== TELEGRAM WEBAPP AUTH =====
exports.telegramWebAppAuth = async (req, res, next) => {
  try {
    const { initData } = req.body;
    if (!initData) throw new AppError('initData is required.', 400);

    // Validate Telegram WebApp initData signature
    const crypto = require('crypto');
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new AppError('Telegram not configured.', 503);

    // Parse initData
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    params.delete('hash');

    // Sort keys and build check string
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // HMAC-SHA256 with secret key = HMAC-SHA256("WebAppData", bot_token)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (expectedHash !== hash) {
      throw new AppError('Invalid Telegram WebApp signature.', 401);
    }

    // Check auth_date is not too old (prevent replay attacks)
    const authDate = parseInt(params.get('auth_date') || '0');
    const age = Math.floor(Date.now() / 1000) - authDate;
    if (age > 86400) throw new AppError('Telegram auth data expired.', 401); // 24hr

    // Parse user from initData
    const tgUser = JSON.parse(params.get('user') || '{}');
    if (!tgUser.id) throw new AppError('No user in initData.', 400);

    const telegramId = String(tgUser.id);

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { telegramChatId: telegramId },
    });

    if (!user) {
      // Check if they have an account by username match (optional)
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Telegram User';
      user = await prisma.user.create({
        data: {
          name,
          telegramChatId: telegramId,
          isVerified: true,
          role: 'BUYER',
          // Store Telegram username for reference
          ...(tgUser.username && { email: null }),
        },
      });
      logger.info(`New user via Telegram WebApp: ${name} (${telegramId})`);
    } else if (!user.isActive) {
      throw new AppError('Account deactivated. Contact support.', 403);
    }

    await sendTokens(user, 200, res, req);
    audit(AUDIT_ACTIONS.USER_LOGIN, { userId: user.id, meta: { method: 'telegram_webapp', telegramId } });
  } catch (err) { next(err); }
};
exports.firebasePhoneAuth = async (req, res, next) => {
  try {
    const { idToken, name, role } = req.body;
    if (!idToken) throw new AppError('Firebase ID token is required.', 400);

    // Verify the Firebase ID token using Firebase Admin SDK
    let firebaseUid, phoneNumber;
    try {
      const admin = require('firebase-admin');
      // Initialize admin if not already done
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          }),
        });
      }
      const decoded = await admin.auth().verifyIdToken(idToken);
      firebaseUid  = decoded.uid;
      phoneNumber  = decoded.phone_number;
    } catch (verifyErr) {
      logger.error('Firebase token verification failed:', verifyErr.message);
      throw new AppError('Invalid or expired verification. Please try again.', 401);
    }

    if (!phoneNumber) throw new AppError('Phone number not found in token.', 400);

    // Find or create user by phone
    let user = await prisma.user.findFirst({ where: { phone: phoneNumber } });

    if (!user) {
      // New user — create account
      const userName = name || `User${phoneNumber.slice(-4)}`;
      user = await prisma.user.create({
        data: {
          name:       userName,
          phone:      phoneNumber,
          isVerified: true,
          role:       role === 'SELLER' ? 'SELLER' : 'BUYER',
        },
      });
      // Send welcome email if they later add an email
    } else {
      // Existing user — mark as verified
      if (!user.isVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data:  { isVerified: true },
        });
      }
    }

    if (!user.isActive) throw new AppError('Account deactivated. Contact support.', 403);

    await sendTokens(user, 200, res, req);
    audit(AUDIT_ACTIONS.USER_LOGIN, { userId: user.id, meta: { method: 'firebase_phone' } });
  } catch (err) { next(err); }
};


exports.phoneAuth = async (req, res, next) => {
  try {
    const { phone, name } = req.body;
    if (!phone) throw new AppError('Phone number is required.', 400);

    // Normalize phone — handle Ethiopian numbers
    let normalized = phone.replace(/\s+/g, '');
    if (normalized.startsWith('09') || normalized.startsWith('07')) {
      normalized = '+251' + normalized.slice(1);
    } else if (normalized.startsWith('9') && normalized.length === 9) {
      normalized = '+251' + normalized;
    }
    if (!normalized.startsWith('+')) normalized = '+' + normalized;

    // Check if phone already exists on ANY account (email or phone registered)
    let user = await prisma.user.findFirst({
      where: { phone: normalized },
    });

    if (!user) {
      // Phone doesn't exist at all — create new account
      if (!name) throw new AppError('Name is required for new accounts.', 400);
      user = await prisma.user.create({
        data: { name, phone: normalized, isVerified: false, role: 'BUYER' },
      });
    }
    // If user exists but was registered via email (has email, phone was optional field)
    // — that's fine, we just log them in via OTP

    if (!user.isActive) throw new AppError('Account deactivated. Contact support.', 403);

    // Delete old OTPs
    await prisma.otpCode.deleteMany({ where: { userId: user.id, type: 'PHONE_LOGIN', used: false } });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.otpCode.create({
      data: { userId: user.id, code, type: 'PHONE_LOGIN', expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    // Always log in dev so you can test
    logger.info(`📱 Phone OTP for ${normalized}: ${code}`);

    // Try SMS — if it fails, try email fallback, if that fails too, return code in dev
    let smsSent = false;
    try {
      await sendSMS(normalized, `Your Hafa Market login code is: ${code}. Valid for 10 minutes.`);
      smsSent = true;
    } catch (smsErr) {
      logger.warn(`SMS failed for ${normalized}: ${smsErr.message}`);
    }

    // Email fallback — if user has email and SMS failed
    if (!smsSent && user.email) {
      try {
        await emailService.sendEmail({
          to: user.email,
          subject: 'Your Hafa Market Phone Verification Code',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#2E7D32">🌿 Hafa Market</h2>
            <p>Your phone verification code is:</p>
            <div style="font-size:2.5rem;font-weight:900;color:#1b5e20;letter-spacing:10px;text-align:center;padding:20px;background:#f0fdf4;border-radius:12px;margin:16px 0">${code}</div>
            <p style="color:#9ca3af;font-size:.85rem">Valid for 10 minutes. Do not share this code.</p>
          </div>`,
        });
        smsSent = true;
        logger.info(`OTP sent via email fallback to ${user.email}`);
      } catch (emailErr) {
        logger.warn(`Email fallback also failed: ${emailErr.message}`);
      }
    }

    res.json({
      success: true,
      isNewUser: !user.isVerified,
      message: smsSent
        ? `Verification code sent to ${normalized}`
        : `Code generated. Check server logs (dev mode).`,
      // In development, include code in response so you can test without SMS
      ...(process.env.NODE_ENV !== 'production' && { devCode: code }),
    });
  } catch (err) { next(err); }
};

// ===== VERIFY PHONE OTP (login) =====
exports.verifyPhoneOtp = async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) throw new AppError('Phone and code are required.', 400);

    const normalized = phone.replace(/\s+/g, '').replace(/^0/, '+251');
    const user = await prisma.user.findUnique({ where: { phone: normalized } });
    if (!user) throw new AppError('No account found with this phone number.', 404);

    const otp = await prisma.otpCode.findFirst({
      where: { userId: user.id, code, type: 'PHONE_LOGIN', used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new AppError('Invalid verification code.', 400);
    if (otp.expiresAt < new Date()) throw new AppError('Code has expired. Please request a new one.', 400);

    await prisma.$transaction([
      prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } }),
      prisma.user.update({ where: { id: user.id }, data: { isVerified: true } }),
    ]);

    await sendTokens(user, 200, res, req);
    audit(AUDIT_ACTIONS.USER_LOGIN, { userId: user.id, meta: { method: 'phone_otp' } });
  } catch (err) { next(err); }
};


exports.googleAuth = async (req, res, next) => {
  try {
    const { googleId, email, name, avatar } = req.body;
    let user = await prisma.user.findFirst({ where: { OR: [{ googleId }, { email }] } });

    if (!user) {
      user = await prisma.user.create({ data: { googleId, email, name, avatar, isVerified: true } });
    } else if (!user.googleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId, isVerified: true } });
    }

    await sendTokens(user, 200, res, req);
  } catch (err) { next(err); }
};

// ===== GET ME =====
exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { seller: { select: { id: true, storeName: true, status: true } } },
    });
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// ===== CHANGE PASSWORD =====
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (user.passwordHash) {
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) throw new AppError('Current password is incorrect.', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) { next(err); }
};

// ===== MAGIC LINK =====
exports.sendMagicLink = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email is required.', 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ success: true, message: 'If that email exists, a magic link has been sent.' });

    const token = require('crypto').randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await prisma.otpCode.create({
      data: { userId: user.id, code: token, type: 'MAGIC_LINK', expiresAt: expires },
    });

    const link = `${process.env.CLIENT_URL}/auth/magic?token=${token}`;
    const emailService = require('../services/email.service');
    await emailService.sendEmail({
      to: email,
      subject: '🌿 Your Hafa Market Magic Link',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#2E7D32">🌿 Hafa Market</h2>
        <p>Click the button below to sign in instantly — no password needed.</p>
        <a href="${link}" style="display:inline-block;background:#2E7D32;color:#fff;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin:16px 0">Sign In to Hafa Market</a>
        <p style="color:#9ca3af;font-size:.85rem">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>`,
    });

    res.json({ success: true, message: 'Magic link sent! Check your email.' });
  } catch (err) { next(err); }
};

exports.verifyMagicLink = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) throw new AppError('Token is required.', 400);

    const otp = await prisma.otpCode.findFirst({
      where: { code: token, type: 'MAGIC_LINK', used: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!otp) throw new AppError('Invalid or expired magic link.', 400);

    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });

    const jwt = require('jsonwebtoken');
    const accessToken  = jwt.sign({ id: otp.user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const refreshToken = jwt.sign({ id: otp.user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN });

    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL}/auth/magic/callback?token=${accessToken}&userId=${otp.user.id}`);
  } catch (err) { next(err); }
};
