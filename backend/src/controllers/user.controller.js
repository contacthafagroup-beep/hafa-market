const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

// ===== GET PROFILE =====
exports.getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id:true, name:true, email:true, phone:true, avatar:true, role:true,
                isVerified:true, language:true, loyaltyPoints:true, createdAt:true,
                seller: { select: { id:true, storeName:true, storeSlug:true, status:true } },
                addresses: { where: { isDefault: true }, take: 1 } },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// ===== UPDATE PROFILE =====
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, avatar, language, fcmToken } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { ...(name && { name }), ...(avatar && { avatar }),
              ...(language && { language }), ...(fcmToken && { fcmToken }) },
      select: { id:true, name:true, email:true, phone:true, avatar:true, language:true },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// ===== ADDRESSES =====
exports.getAddresses = async (req, res, next) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: addresses });
  } catch (err) { next(err); }
};

exports.addAddress = async (req, res, next) => {
  try {
    const { label, fullName, phone, street, city, region, country, postalCode, latitude, longitude, isDefault } = req.body;

    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
    }

    const address = await prisma.address.create({
      data: { userId: req.user.id, label: label || 'Home', fullName, phone, street, city,
              region, country: country || 'Ethiopia', postalCode, latitude, longitude,
              isDefault: isDefault || false },
    });
    res.status(201).json({ success: true, data: address });
  } catch (err) { next(err); }
};

exports.updateAddress = async (req, res, next) => {
  try {
    const address = await prisma.address.findUnique({ where: { id: req.params.id } });
    if (!address || address.userId !== req.user.id) throw new AppError('Address not found.', 404);

    if (req.body.isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
    }

    const updated = await prisma.address.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    const address = await prisma.address.findUnique({ where: { id: req.params.id } });
    if (!address || address.userId !== req.user.id) throw new AppError('Address not found.', 404);
    await prisma.address.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Address deleted.' });
  } catch (err) { next(err); }
};

exports.setDefaultAddress = async (req, res, next) => {
  try {
    const address = await prisma.address.findUnique({ where: { id: req.params.id } });
    if (!address || address.userId !== req.user.id) throw new AppError('Address not found.', 404);
    await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
    await prisma.address.update({ where: { id: req.params.id }, data: { isDefault: true } });
    res.json({ success: true, message: 'Default address updated.' });
  } catch (err) { next(err); }
};

// ===== WISHLIST =====
exports.getWishlist = async (req, res, next) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { seller: { select: { storeName:true } },
                                       category: { select: { name:true, emoji:true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
};

exports.toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const existing = await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId: req.user.id, productId } },
    });
    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      return res.json({ success: true, action: 'removed', message: 'Removed from wishlist.' });
    }
    const item = await prisma.wishlistItem.create({
      data: { userId: req.user.id, productId },
      include: { product: { select: { name:true, price:true, images:true } } },
    });
    res.status(201).json({ success: true, action: 'added', data: item });
  } catch (err) { next(err); }
};

// ===== LOYALTY POINTS =====
exports.getLoyaltyPoints = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }, select: { loyaltyPoints: true },
    });
    const pointsValue = (user.loyaltyPoints / 100).toFixed(2);
    res.json({ success: true, data: { points: user.loyaltyPoints, valueUSD: pointsValue } });
  } catch (err) { next(err); }
};

// ===== NOTIFICATIONS =====
exports.getNotifications = async (req, res, next) => {
  try {
    const { page=1, limit=20 } = req.query;
    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
      }),
      prisma.notification.count({ where: { userId: req.user.id } }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);
    res.json({ success:true, data:notifications, unread,
      pagination: { page:parseInt(page), limit:parseInt(limit), total } });
  } catch (err) { next(err); }
};

exports.markNotificationsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false }, data: { isRead: true },
    });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { next(err); }
};
