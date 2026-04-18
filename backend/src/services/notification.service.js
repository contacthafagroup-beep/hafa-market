const prisma = require('../config/prisma');
const logger = require('../config/logger');

// Map any type string to a valid NotificationType enum value
const TYPE_MAP = {
  ORDER:            'ORDER_PLACED',
  ORDER_PLACED:     'ORDER_PLACED',
  ORDER_CONFIRMED:  'ORDER_CONFIRMED',
  ORDER_SHIPPED:    'ORDER_SHIPPED',
  ORDER_DELIVERED:  'ORDER_DELIVERED',
  ORDER_CANCELLED:  'ORDER_CANCELLED',
  PAYMENT_SUCCESS:  'PAYMENT_SUCCESS',
  PAYMENT_FAILED:   'PAYMENT_FAILED',
  NEW_MESSAGE:      'NEW_MESSAGE',
  PROMO:            'PROMO',
  SYSTEM:           'SYSTEM',
  DELIVERY:         'ORDER_SHIPPED',
};

exports.createNotification = async (userId, type, title, body, data = {}) => {
  try {
    const safeType = TYPE_MAP[type] || 'SYSTEM';
    const notification = await prisma.notification.create({
      data: { userId, type: safeType, title, body, data },
    });

    // Send push notification via FCM if user has token
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
    if (user?.fcmToken) {
      await sendPushNotification(user.fcmToken, title, body, data);
    }

    return notification;
  } catch (err) {
    logger.error('Notification error:', err.message);
  }
};

async function sendPushNotification(token, title, body, data) {
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) return; // not initialized — skip silently
    await admin.messaging().send({ token, notification: { title, body }, data: { ...data } });
  } catch (err) {
    logger.error('FCM push error:', err.message);
  }
}
