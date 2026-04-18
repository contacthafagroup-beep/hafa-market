const router = require('express').Router();
const ctrl = require('../controllers/ai.controller');
const { protect, optionalAuth } = require('../middleware/auth.middleware');

router.post('/chat',                       optionalAuth, ctrl.chat);
router.get('/recommendations',             optionalAuth, ctrl.getRecommendations);
router.get('/recommendations/engine',      optionalAuth, ctrl.getEngineRecommendations);
router.post('/recommendations/click',      optionalAuth, ctrl.trackRecommendationClick); // real-time update
router.get('/recommendations/user/:userId',protect,      ctrl.getUserVector);            // admin debug
router.get('/similar/:id',                 ctrl.getSimilarProducts);
router.post('/analyze-image',              optionalAuth, ctrl.analyzeImage);

module.exports = router;
