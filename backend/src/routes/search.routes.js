const router = require('express').Router();
const ctrl   = require('../controllers/search.controller');
const { optionalAuth, protect, restrictTo } = require('../middleware/auth.middleware');

router.get('/',              optionalAuth, ctrl.search);
router.get('/autocomplete',  optionalAuth, ctrl.autocomplete);
router.get('/trending',                   ctrl.getTrending);
router.post('/click',        optionalAuth, ctrl.trackClick);          // feedback loop
router.post('/external',     optionalAuth, ctrl.trackExternalTraffic); // UPGRADE 3: external traffic
router.get('/analytics',     protect, restrictTo('ADMIN'), ctrl.getSearchAnalytics); // admin
router.get('/intent-graph',  ctrl.getIntentGraph); // expose intent graph for frontend

module.exports = router;
