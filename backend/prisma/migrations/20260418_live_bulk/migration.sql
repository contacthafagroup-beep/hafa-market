-- Live Bulk Purchase Deals
-- Seller sets quantity-based discounts for a product during live session
-- e.g. Buy 5kg = 10% off, Buy 10kg = 20% off, Buy 20kg = 30% off
CREATE TABLE IF NOT EXISTS "live_bulk_deals" (
  "id"          TEXT NOT NULL,
  "sessionId"   TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "basePrice"   DOUBLE PRECISION NOT NULL,
  "tiers"       JSONB NOT NULL DEFAULT '[]',
  -- tiers: [{ minQty: 5, discount: 10, price: 45 }, { minQty: 10, discount: 20, price: 40 }]
  "maxQty"      INTEGER,           -- seller's max per buyer (optional)
  "totalSold"   INTEGER NOT NULL DEFAULT 0,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | ENDED
  "endsAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_bulk_deals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "live_bulk_deals_sessionId_idx" ON "live_bulk_deals"("sessionId");
CREATE INDEX IF NOT EXISTS "live_bulk_deals_status_idx" ON "live_bulk_deals"("status");
