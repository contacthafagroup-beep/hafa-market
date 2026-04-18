'use strict';
const { Server } = require('socket.io');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('./config/prisma');
const logger = require('./config/logger');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'http://localhost:3001',
        ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',') : []),
      ],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // ── Auth middleware (optional — anonymous viewers allowed) ──────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) { socket.userId = null; return next(); }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      socket.userId = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.userId || 'anonymous'}`);
    if (socket.userId) socket.join(`user:${socket.userId}`);

    // ── Support chat ──────────────────────────────────────────────────────────
    socket.on('chat:join',  (roomId) => socket.join(`room:${roomId}`));
    socket.on('chat:leave', (roomId) => socket.leave(`room:${roomId}`));

    socket.on('chat:message', async (data) => {
      try {
        if (!socket.userId) return;
        const { roomId, type = 'TEXT', content, fileUrl, fileName, fileSize, mimeType, duration } = data;
        const message = await prisma.chatMessage.create({
          data: { roomId, senderId: socket.userId, type, content, fileUrl, fileName, fileSize, mimeType, duration },
          include: { sender: { select: { id: true, name: true, avatar: true } } },
        });
        io.to(`room:${roomId}`).emit('chat:message', message);
      } catch (err) {
        socket.emit('chat:error', { message: err.message });
      }
    });

    socket.on('chat:typing', ({ roomId, isTyping }) => {
      if (!socket.userId) return;
      socket.to(`room:${roomId}`).emit('chat:typing', { userId: socket.userId, isTyping });
    });

    // ── CRO product page viewer tracking ─────────────────────────────────────
    socket.on('product:join', (productId) => {
      socket.join(`product:${productId}`);
      socket.data.productId = productId;
    });
    socket.on('product:leave', (productId) => {
      socket.leave(`product:${productId}`);
      socket.data.productId = null;
    });

    // ── Delivery tracking ─────────────────────────────────────────────────────
    socket.on('delivery:location', async ({ orderId, lat, lng }) => {
      try {
        await prisma.delivery.updateMany({ where: { orderId }, data: { currentLat: lat, currentLng: lng } });
        const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
        if (order) io.to(`user:${order.userId}`).emit('delivery:location', { orderId, lat, lng });
      } catch (err) {
        logger.error('Delivery tracking error:', err);
      }
    });

    // ── LIVE COMMERCE ─────────────────────────────────────────────────────────

    // Viewer joins a live session room
    socket.on('live:join', (sessionId) => {
      socket.join(`live:${sessionId}`);
      socket.data.liveSessionId = sessionId;
      const room = io.sockets.adapter.rooms.get(`live:${sessionId}`);
      const count = room ? room.size : 1;
      io.to(`live:${sessionId}`).emit('live:viewers', { sessionId, count });
      prisma.liveSession.update({
        where: { id: sessionId },
        data: { viewerCount: count },
      }).catch(() => {});
    });

    // Viewer leaves
    socket.on('live:leave', (sessionId) => {
      socket.leave(`live:${sessionId}`);
      const room = io.sockets.adapter.rooms.get(`live:${sessionId}`);
      const count = room ? room.size : 0;
      io.to(`live:${sessionId}`).emit('live:viewers', { sessionId, count });
    });

    // ── WebRTC Signaling (seller → viewers) ──────────────────────────────────

    // Seller is ready to stream — notify all viewers in the room
    socket.on('live:seller_ready', ({ sessionId }) => {
      socket.data.isSeller = true;
      socket.data.sellerSessionId = sessionId;
      socket.to(`live:${sessionId}`).emit('live:seller_ready', { sessionId });
    });

    // Seller stopped streaming
    socket.on('live:seller_stopped', ({ sessionId }) => {
      socket.to(`live:${sessionId}`).emit('live:seller_stopped', { sessionId });
    });

    // Viewer wants to join the stream — notify seller to create peer connection
    socket.on('live:viewer_join', ({ sessionId, viewerId }) => {
      socket.data.viewerId = viewerId;
      // Find the seller socket in this session room
      const room = io.sockets.adapter.rooms.get(`live:${sessionId}`);
      if (room) {
        room.forEach(socketId => {
          const s = io.sockets.sockets.get(socketId);
          if (s?.data.isSeller && s.data.sellerSessionId === sessionId) {
            s.emit('live:viewer_joined', { viewerId: socket.id, sessionId });
          }
        });
      }
    });

    // WebRTC offer from seller to viewer
    socket.on('live:offer', ({ to, offer, sessionId }) => {
      io.to(to).emit('live:offer', { offer, from: socket.id, sessionId });
    });

    // WebRTC answer from viewer to seller
    socket.on('live:answer', ({ sessionId, answer }) => {
      // Find seller in the session
      const room = io.sockets.adapter.rooms.get(`live:${sessionId}`);
      if (room) {
        room.forEach(socketId => {
          const s = io.sockets.sockets.get(socketId);
          if (s?.data.isSeller && s.data.sellerSessionId === sessionId) {
            s.emit('live:answer', { from: socket.id, answer });
          }
        });
      }
    });

    // ICE candidates (bidirectional)
    socket.on('live:ice', ({ to, candidate, sessionId }) => {
      if (to === 'seller') {
        // Viewer → Seller
        const room = io.sockets.adapter.rooms.get(`live:${sessionId}`);
        if (room) {
          room.forEach(socketId => {
            const s = io.sockets.sockets.get(socketId);
            if (s?.data.isSeller) s.emit('live:ice_candidate', { from: socket.id, candidate });
          });
        }
      } else {
        // Seller → specific viewer
        io.to(to).emit('live:ice_candidate', { from: socket.id, candidate });
      }
    });

    // Live chat message (Part 2: Real-time interaction)
    socket.on('live:message', async (data) => {
      const { sessionId, content, type = 'CHAT', isQuestion = false } = data;
      if (!content?.trim() || !sessionId) return;

      // Spam filter: max 3 messages per 5 seconds per socket
      const spamKey = `spam:${socket.id}`;
      socket.data[spamKey] = (socket.data[spamKey] || 0) + 1;
      setTimeout(() => { socket.data[spamKey] = Math.max(0, (socket.data[spamKey] || 0) - 1); }, 5000);
      if (socket.data[spamKey] > 3) return;

      let userName = 'Guest';
      let userAvatar = null;
      if (socket.userId) {
        const u = await prisma.user.findUnique({
          where: { id: socket.userId },
          select: { name: true, avatar: true },
        }).catch(() => null);
        if (u) { userName = u.name; userAvatar = u.avatar; }
      }

      const msg = {
        id: crypto.randomUUID(),
        sessionId, userId: socket.userId, userName, userAvatar,
        type, content: content.trim(), isQuestion,
        createdAt: new Date().toISOString(),
      };

      // Persist
      prisma.$queryRaw`
        INSERT INTO live_messages (id, "sessionId", "userId", "userName", "userAvatar", type, content, "isQuestion", "createdAt")
        VALUES (${msg.id}, ${sessionId}, ${socket.userId}, ${userName}, ${userAvatar}, ${type}, ${content.trim()}, ${isQuestion}, NOW())
      `.catch(() => {});

      io.to(`live:${sessionId}`).emit('live:message', msg);
    });

    // Emoji reaction — ephemeral, no DB (Part 2: Reactions)
    socket.on('live:reaction', ({ sessionId, emoji }) => {
      if (!sessionId || !emoji) return;
      io.to(`live:${sessionId}`).emit('live:reaction', {
        userId: socket.userId,
        emoji,
        id: Math.random().toString(36).slice(2),
      });
    });

    // Seller pins a product with optional special price + countdown (Part 3: Product Pinning)
    socket.on('live:pin_product', async (data) => {
      const { sessionId, productId, specialPrice, limitedStock, durationSeconds } = data;
      if (!socket.userId || !productId || !sessionId) return;

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true, images: true, unit: true, stock: true, slug: true },
      }).catch(() => null);
      if (!product) return;

      const endsAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null;
      const pinId  = crypto.randomUUID();

      prisma.$queryRaw`
        INSERT INTO live_pinned_products (id, "sessionId", "productId", "specialPrice", "limitedStock", "endsAt", "isPinned")
        VALUES (${pinId}, ${sessionId}, ${productId}, ${specialPrice || null}, ${limitedStock || null}, ${endsAt}, true)
      `.catch(() => {});

      io.to(`live:${sessionId}`).emit('live:product_pinned', {
        pinId, sessionId, ...product,
        specialPrice: specialPrice || product.price,
        originalPrice: product.price,
        limitedStock: limitedStock || product.stock,
        endsAt: endsAt?.toISOString(),
        discount: specialPrice ? Math.round((1 - specialPrice / product.price) * 100) : 0,
      });

      if (durationSeconds) {
        setTimeout(() => {
          io.to(`live:${sessionId}`).emit('live:product_unpinned', { pinId, sessionId });
        }, durationSeconds * 1000);
      }
    });

    // Seller unpins product
    socket.on('live:unpin_product', ({ sessionId, pinId }) => {
      io.to(`live:${sessionId}`).emit('live:product_unpinned', { pinId, sessionId });
    });

    // Social proof: order placed during live (Part 6: Psychology)
    socket.on('live:order_placed', ({ sessionId, productName, buyerName, amount }) => {
      io.to(`live:${sessionId}`).emit('live:order_flash', {
        message: `🛒 ${buyerName || 'Someone'} just bought ${productName}!`,
        productId: null,
        amount: amount || 0,
        createdAt: new Date().toISOString(),
      });
    });

    // CHANGE #9 — viewer "want" reaction on a product
    socket.on('live:want', ({ sessionId, productId }) => {
      if (!sessionId || !productId) return;
      // Track in memory (could persist to Redis for accuracy)
      const wantKey = `want:${sessionId}:${productId}`;
      socket.data[wantKey] = (socket.data[wantKey] || 0) + 1;
      // Broadcast updated want count to room
      const room = io.sockets.adapter.rooms.get(`live:${sessionId}`);
      let totalWants = 0;
      if (room) {
        room.forEach(sid => {
          const s = io.sockets.sockets.get(sid);
          totalWants += (s?.data[wantKey] || 0);
        });
      }
      io.to(`live:${sessionId}`).emit('live:want_update', { productId, count: totalWants });
    });

    // ── LIVE AUCTION (Whatnot-style) ──────────────────────────────────────────
    // Optimistic bid broadcast — actual validation in REST endpoint
    socket.on('live:bid_optimistic', ({ sessionId, auctionId, amount, userName }) => {
      io.to(`live:${sessionId}`).emit('live:auction_bid', {
        auctionId, sessionId,
        userId: socket.userId,
        userName: userName || 'Bidder',
        amount,
        isOptimistic: true,
      });
    });

    // ── GROUP BUY (Pinduoduo-style) ───────────────────────────────────────────
    // Optimistic join broadcast — actual join in REST endpoint
    socket.on('live:groupbuy_join_optimistic', ({ sessionId, groupBuyId, userName, quantity }) => {
      io.to(`live:${sessionId}`).emit('live:groupbuy_joined', {
        groupBuyId, sessionId,
        userId: socket.userId,
        userName: userName || 'Buyer',
        quantity: quantity || 1,
        isOptimistic: true,
      });
    });
    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const liveSessionId = socket.data.liveSessionId;
      if (liveSessionId) {
        const room = io.sockets.adapter.rooms.get(`live:${liveSessionId}`);
        const count = room ? room.size : 0;
        io.to(`live:${liveSessionId}`).emit('live:viewers', { sessionId: liveSessionId, count });
      }
      logger.info(`Socket disconnected: ${socket.userId || 'anonymous'}`);
    });
  });

  return io;
}

function getIO() { return io; }

module.exports = { initSocket, getIO };
