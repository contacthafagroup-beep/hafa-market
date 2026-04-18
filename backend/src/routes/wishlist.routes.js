const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/',        ctrl.getWishlist);
router.post('/toggle', ctrl.toggleWishlist);

module.exports = router;
