const router = require('express').Router();
const ctrl = require('../controllers/delivery.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.get('/zones',                ctrl.getDeliveryZones);
router.post('/calculate-fee',       ctrl.calculateDeliveryFee);
router.get('/track/:trackingCode',  ctrl.trackOrder);

router.use(protect);
router.get('/agent/deliveries',     restrictTo('DELIVERY_AGENT'), ctrl.getAgentDeliveries);
router.patch('/agent/:id/status',   restrictTo('DELIVERY_AGENT'), ctrl.updateDeliveryStatus);
router.post('/agent/location',      restrictTo('DELIVERY_AGENT'), ctrl.updateAgentLocation);
router.get('/agent/profile',        restrictTo('DELIVERY_AGENT'), ctrl.getAgentProfile);
router.patch('/agent/availability', restrictTo('DELIVERY_AGENT'), ctrl.setAgentAvailability);
router.post('/assign',              restrictTo('ADMIN'), ctrl.assignAgent);
router.get('/agents/available',     restrictTo('ADMIN'), ctrl.getAvailableAgents);

// Proof of Delivery
router.post('/agent/:id/proof',     restrictTo('DELIVERY_AGENT'), ctrl.submitProofOfDelivery);
router.get('/proof/:deliveryId',    ctrl.getProofOfDelivery);

module.exports = router;
