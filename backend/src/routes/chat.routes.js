const router = require('express').Router();
const prisma = require('../config/prisma');
const { protect } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/errorHandler');

router.use(protect);

// Get or create support room
router.post('/support', async (req, res, next) => {
  try {
    let room = await prisma.chatRoom.findFirst({
      where: { type: 'SUPPORT', participants: { some: { userId: req.user.id } } },
      include: { participants: true },
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: { type: 'SUPPORT',
                participants: { create: { userId: req.user.id } } },
        include: { participants: true },
      });
    }
    res.json({ success: true, data: room });
  } catch(err) { next(err); }
});

// Get messages
router.get('/:roomId/messages', async (req, res, next) => {
  try {
    const { page=1, limit=50 } = req.query;
    const messages = await prisma.chatMessage.findMany({
      where: { roomId: req.params.roomId },
      skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { id:true, name:true, avatar:true, role:true } } },
    });
    res.json({ success: true, data: messages.reverse() });
  } catch(err) { next(err); }
});

// Send message (REST fallback, socket is primary)
router.post('/:roomId/messages', async (req, res, next) => {
  try {
    const { type='TEXT', content, fileUrl, fileName, fileSize, mimeType } = req.body;
    const message = await prisma.chatMessage.create({
      data: { roomId: req.params.roomId, senderId: req.user.id, type, content, fileUrl, fileName, fileSize, mimeType },
      include: { sender: { select: { id:true, name:true, avatar:true } } },
    });
    res.status(201).json({ success: true, data: message });
  } catch(err) { next(err); }
});

module.exports = router;
