const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/',          ctrl.getNotifications);
router.patch('/read-all',ctrl.markNotificationsRead);

module.exports = router;
