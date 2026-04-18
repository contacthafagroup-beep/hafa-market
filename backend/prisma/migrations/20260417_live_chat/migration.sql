-- Live chat messages
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
CREATE INDEX IF NOT EXISTS "live_messages_createdAt_idx" ON "live_messages"("createdAt");

-- Live pinned products (product spotlight during stream)
CREATE TABLE IF NOT EXISTS "live_pinned_products" (
  "id"           TEXT NOT NULL,
  "sessionId"    TEXT NOT NULL,
  "productId"    TEXT NOT NULL,
  "specialPrice" DOUBLE PRECISION,
  "limitedStock" INTEGER,
  "endsAt"       TIMESTAMP(3),
  "isPinned"     BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_pinned_products_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "live_pinned_products_sessionId_idx" ON "live_pinned_products"("sessionId");
