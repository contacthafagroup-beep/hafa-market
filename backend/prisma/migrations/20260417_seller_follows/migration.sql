-- Seller follows (for "LIVE now" notifications)
CREATE TABLE IF NOT EXISTS "seller_follows" (
  "userId"    TEXT NOT NULL,
  "sellerId"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_follows_pkey" PRIMARY KEY ("userId", "sellerId")
);
CREATE INDEX IF NOT EXISTS "seller_follows_sellerId_idx" ON "seller_follows"("sellerId");
CREATE INDEX IF NOT EXISTS "seller_follows_userId_idx" ON "seller_follows"("userId");

-- Live session reminders tracking (prevent duplicate reminders)
CREATE TABLE IF NOT EXISTS "live_reminders_sent" (
  "sessionId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "type"      TEXT NOT NULL DEFAULT 'REMINDER_15MIN',
  "sentAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_reminders_sent_pkey" PRIMARY KEY ("sessionId", "userId", "type")
);
