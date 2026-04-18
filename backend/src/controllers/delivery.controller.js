const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

// ===== DELIVERY ZONES & FEE CALCULATION =====
exports.calculateDeliveryFee = async (req, res, next) => {
  try {
    const { city, subtotal, fromCity } = req.body;

    // Try DB zones first (seeded with real Ethiopian cities)
    const zone = await prisma.deliveryZone.findFirst({
      where: {
        toCity:   { contains: city || 'Hossana', mode: 'insensitive' },
        fromCity: { contains: fromCity || 'Hossana', mode: 'insensitive' },
        isActive: true,
      },
    }).catch(() => null);

    if (zone) {
      const fee = parseFloat(subtotal) >= 50 ? 0 : zone.baseFee;
      const eta = zone.minDays === zone.maxDays
        ? `${zone.minDays} day${zone.minDays > 1 ? 's' : ''}`
        : `${zone.minDays}–${zone.maxDays} days`;
      return res.json({ success: true, data: { fee, freeThreshold: 50, eta, city, fromCity, minDays: zone.minDays, maxDays: zone.maxDays } });
    }

    // Fallback defaults
    const fee = parseFloat(subtotal) >= 50 ? 0 : 3.99;
    res.json({ success: true, data: { fee, freeThreshold: 50, eta: '2–4 days', city, minDays: 2, maxDays: 4 } });
  } catch (err) { next(err); }
};

exports.getDeliveryZones = async (req, res, next) => {
  try {
    const zones = await prisma.deliveryZone.findMany({ where: { isActive: true }, orderBy: [{ fromCity: 'asc' }, { toCity: 'asc' }] });
    res.json({ success: true, data: zones });
  } catch (err) { next(err); }
};

// ===== TRACK ORDER =====
exports.trackOrder = async (req, res, next) => {
  try {
    const { trackingCode } = req.params;
    const delivery = await prisma.delivery.findUnique({
      where: { trackingCode },
      include: {
        order: { include: { items: true, address: true, statusHistory: { orderBy: { createdAt: 'asc' } } } },
        agent: true,
      },
    });
    if (!delivery) throw new AppError('Tracking code not found.', 404);
    res.json({ success: true, data: delivery });
  } catch (err) { next(err); }
};

// ===== AGENT: GET ASSIGNED DELIVERIES =====
exports.getAgentDeliveries = async (req, res, next) => {
  try {
    const agent = await prisma.deliveryAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) throw new AppError('Delivery agent account not found.', 404);

    const deliveries = await prisma.delivery.findMany({
      where: { agentId: agent.id, status: { in: ['ASSIGNED','PICKED_UP','IN_TRANSIT'] } },
      include: { order: { include: { address: true, items: true, user: { select: { name:true, phone:true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: deliveries });
  } catch (err) { next(err); }
};

// ===== AGENT: UPDATE DELIVERY STATUS =====
exports.updateDeliveryStatus = async (req, res, next) => {
  try {
    const { status, lat, lng, notes, estimatedAt } = req.body;
    const agent = await prisma.deliveryAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) throw new AppError('Delivery agent account not found.', 404);

    const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
    if (!delivery || delivery.agentId !== agent.id) throw new AppError('Delivery not found.', 404);

    const updateData = { status, notes,
      ...(lat && lng && { currentLat: lat, currentLng: lng }),
      ...(estimatedAt && { estimatedAt: new Date(estimatedAt) }),
      ...(status === 'PICKED_UP' && { pickedUpAt: new Date() }),
      ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
    };

    const updated = await prisma.delivery.update({ where: { id: delivery.id }, data: updateData });

    // Sync order status
    const orderStatusMap = { PICKED_UP:'SHIPPED', IN_TRANSIT:'OUT_FOR_DELIVERY', DELIVERED:'DELIVERED' };
    if (orderStatusMap[status]) {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: orderStatusMap[status],
                ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
                statusHistory: { create: { status: orderStatusMap[status], note: notes || `Delivery ${status}` } } },
      });
      if (status === 'DELIVERED') {
        await prisma.deliveryAgent.update({ where: { id: agent.id }, data: { totalDeliveries: { increment: 1 } } });
      }
    }

    // Broadcast location via socket
    const { getIO } = require('../socket');
    const io = getIO();
    if (io && lat && lng) {
      io.to(`user:${delivery.order?.userId}`).emit('delivery:location', { orderId: delivery.orderId, lat, lng, status });
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// ===== ADMIN: ASSIGN AGENT =====
exports.assignAgent = async (req, res, next) => {
  try {
    const { deliveryId, agentId } = req.body;
    const agent = await prisma.deliveryAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new AppError('Agent not found.', 404);

    const trackingCode = `HM-${Date.now().toString(36).toUpperCase()}`;
    const delivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        agentId,
        status: 'ASSIGNED',
        trackingCode,
        estimatedAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // default 48h ETA
      },
    });

    await prisma.deliveryAgent.update({ where: { id: agentId }, data: { isAvailable: false } });
    res.json({ success: true, data: delivery });
  } catch (err) { next(err); }
};

// ===== AVAILABLE AGENTS =====
exports.getAvailableAgents = async (req, res, next) => {
  try {
    const agents = await prisma.deliveryAgent.findMany({
      where: { isAvailable: true },
      include: { user: { select: { name:true, phone:true, avatar:true } } },
    });
    res.json({ success: true, data: agents });
  } catch (err) { next(err); }
};

// ===== AGENT: UPDATE LOCATION (frequent GPS ping) =====
exports.updateAgentLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) throw new AppError('lat and lng are required.', 400);

    const agent = await prisma.deliveryAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) throw new AppError('Agent not found.', 404);

    await prisma.deliveryAgent.update({ where: { id: agent.id }, data: { currentLat: lat, currentLng: lng } });

    // Broadcast to any active delivery's customer
    const activeDelivery = await prisma.delivery.findFirst({
      where: { agentId: agent.id, status: { in: ['PICKED_UP','IN_TRANSIT'] } },
      include: { order: { select: { userId: true, id: true } } },
    });

    if (activeDelivery?.order) {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io) {
        io.to(`user:${activeDelivery.order.userId}`).emit('delivery:location', {
          orderId: activeDelivery.orderId, lat, lng, status: activeDelivery.status,
        });
      }
    }

    res.json({ success: true });
  } catch (err) { next(err); }
};

// ===== AGENT: GET PROFILE =====
exports.getAgentProfile = async (req, res, next) => {
  try {
    const agent = await prisma.deliveryAgent.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { name: true, phone: true, avatar: true, email: true } },
        deliveries: { where: { status: 'DELIVERED' }, select: { id: true }, take: 1 },
      },
    });
    if (!agent) throw new AppError('Agent profile not found.', 404);
    res.json({ success: true, data: agent });
  } catch (err) { next(err); }
};

// ===== AGENT: SET AVAILABILITY =====
exports.setAgentAvailability = async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    const agent = await prisma.deliveryAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) throw new AppError('Agent not found.', 404);
    await prisma.deliveryAgent.update({ where: { id: agent.id }, data: { isAvailable } });
    res.json({ success: true, message: `You are now ${isAvailable ? 'available' : 'unavailable'} for deliveries.` });
  } catch (err) { next(err); }
};

// ===== PROOF OF DELIVERY =====
exports.submitProofOfDelivery = async (req, res, next) => {
  try {
    const { photoUrl, signature, latitude, longitude } = req.body;
    if (!photoUrl) throw new AppError('Photo URL is required.', 400);

    const agent = await prisma.deliveryAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) throw new AppError('Agent not found.', 404);

    const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
    if (!delivery || delivery.agentId !== agent.id) throw new AppError('Delivery not found.', 404);

    const proof = await prisma.proofOfDelivery.upsert({
      where: { deliveryId: delivery.id },
      update: { photoUrl, signature, latitude, longitude, capturedAt: new Date() },
      create: { deliveryId: delivery.id, photoUrl, signature, latitude, longitude },
    });

    res.status(201).json({ success: true, data: proof });
  } catch (err) { next(err); }
};

exports.getProofOfDelivery = async (req, res, next) => {
  try {
    const proof = await prisma.proofOfDelivery.findUnique({
      where: { deliveryId: req.params.deliveryId },
    });
    res.json({ success: true, data: proof });
  } catch (err) { next(err); }
};
