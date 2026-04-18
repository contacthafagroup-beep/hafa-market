-- Live Messages (chat during live sessions)
CREATE TABLE IF NOT EXISTS "live_messages" (
  "id"          TEXT NOT NULL,
  "sessionId"   TEXT NOT NULL,
  "userId"      TEXT,
  "userName"    TEXT NOT NULL DEFAULT 'Guest',
  "userAvatar"  TEXT,
  "type"        TEXT NOT NULL DEFAULT 'CHAT',
  "content"     TEXT NOT NULL,
  "emoji"       TEXT,
  "isQuestion"  BOOLEAN NOT NULL DEFAULT false,
  "isAnswered"  BOOLEAN NOT NULL DEFAULT false,
  "isPinned"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "live_messages_sessionId_idx" ON "live_messages"("sessionId");
CREATE INDEX IF NOT EXISTS "live_messages_type_idx" ON "live_messages"("type");

-- Live Products (pinned products during a session)
CREATE TABLE IF NOT EXISTS "live_products" (
  "id"             TEXT NOT NULL,
  "sessionId"      TEXT NOT NULL,
  "productId"      TEXT NOT NULL,
  "productName"    TEXT NOT NULL,
  "productImage"   TEXT,
  "originalPrice"  DOUBLE PRECISION NOT NULL,
  "livePrice"      DOUBLE PRECISION NOT NULL,
  "stock"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "soldDuringLive" INTEGER NOT NULL DEFAULT 0,
  "isPinned"       BOOLEAN NOT NULL DEFAULT false,
  "isFlashDeal"    BOOLEAN NOT NULL DEFAULT false,
  "flashEndsAt"    TIMESTAMP(3),
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_products_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "live_products_sessionId_idx" ON "live_products"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "live_products_session_product_key" ON "live_products"("sessionId","productId");

-- Live Orders (orders placed during a live session)
CREATE TABLE IF NOT EXISTS "live_orders" (
  "id"          TEXT NOT NULL,
  "sessionId"   TEXT NOT NULL,
  "orderId"     TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "userName"    TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "quantity"    DOUBLE PRECISION NOT NULL,
  "total"       DOUBLE PRECISION NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "live_orders_sessionId_idx" ON "live_orders"("sessionId");
