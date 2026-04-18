const logger = require('../config/logger');

exports.sendSMS = async (phone, message) => {
  try {
    const AfricasTalking = require('africastalking');
    const at = AfricasTalking({ apiKey: process.env.AT_API_KEY, username: process.env.AT_USERNAME });
    await at.SMS.send({ to: [phone], message, from: process.env.AT_SENDER_ID });
    logger.info(`SMS sent to ${phone}`);
  } catch (err) {
    logger.error('SMS error:', err.message);
    // Don't throw — SMS failure shouldn't break the flow
  }
};
