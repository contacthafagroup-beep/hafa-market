-- Live Auction Bids (Whatnot-style)
CREATE TABLE IF NOT EXISTS "auction_bids" (
  "id"          TEXT NOT NULL,
  "sessionId"   TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "auctionId"   TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "userName"    TEXT NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auction_bids_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "auction_bids_auctionId_idx" ON "auction_bids"("auctionId");
CREATE INDEX IF NOT EXISTS "auction_bids_sessionId_idx" ON "auction_bids"("sessionId");

-- Live Auctions (one per product per session)
CREATE TABLE IF NOT EXISTS "live_auctions" (
  "id"            TEXT NOT NULL,
  "sessionId"     TEXT NOT NULL,
  "productId"     TEXT NOT NULL,
  "startPrice"    DOUBLE PRECISION NOT NULL,
  "currentPrice"  DOUBLE PRECISION NOT NULL,
  "minIncrement"  DOUBLE PRECISION NOT NULL DEFAULT 5,
  "leaderId"      TEXT,
  "leaderName"    TEXT,
  "durationSecs"  INTEGER NOT NULL DEFAULT 60,
  "endsAt"        TIMESTAMP(3) NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | ENDED | CANCELLED
  "winnerId"      TEXT,
  "winnerName"    TEXT,
  "finalPrice"    DOUBLE PRECISION,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_auctions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "live_auctions_sessionId_idx" ON "live_auctions"("sessionId");
CREATE INDEX IF NOT EXISTS "live_auctions_status_idx" ON "live_auctions"("status");

-- Group Buy Sessions (Pinduoduo-style)
CREATE TABLE IF NOT EXISTS "group_buy_sessions" (
  "id"            TEXT NOT NULL,
  "sessionId"     TEXT NOT NULL,
  "productId"     TEXT NOT NULL,
  "basePrice"     DOUBLE PRECISION NOT NULL,
  "tiers"         JSONB NOT NULL DEFAULT '[]',
  -- tiers: [{ qty: 5, price: 60 }, { qty: 10, price: 50 }, { qty: 20, price: 40 }]
  "currentQty"    INTEGER NOT NULL DEFAULT 0,
  "currentPrice"  DOUBLE PRECISION NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'OPEN',  -- OPEN | COMPLETED | EXPIRED
  "endsAt"        TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_buy_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "group_buy_sessions_sessionId_idx" ON "group_buy_sessions"("sessionId");

-- Group Buy Participants
CREATE TABLE IF NOT EXISTS "group_buy_participants" (
  "id"              TEXT NOT NULL,
  "groupBuyId"      TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "userName"        TEXT NOT NULL,
  "quantity"        INTEGER NOT NULL DEFAULT 1,
  "priceLocked"     DOUBLE PRECISION NOT NULL,
  "orderId"         TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_buy_participants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "group_buy_participants_groupBuyId_idx" ON "group_buy_participants"("groupBuyId");
CREATE UNIQUE INDEX IF NOT EXISTS "group_buy_participants_unique" ON "group_buy_participants"("groupBuyId", "userId");
