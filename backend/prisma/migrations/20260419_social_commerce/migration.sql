-- Social Feed Events (what appears in the community feed)
CREATE TABLE IF NOT EXISTS "social_feed_events" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  -- PURCHASE | REVIEW | SHARE | FOLLOW | UGC | WISHLIST | LIVE_JOIN
  "productId"   TEXT,
  "sellerId"    TEXT,
  "meta"        JSONB,
  "isPublic"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "social_feed_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "social_feed_events_userId_idx" ON "social_feed_events"("userId");
CREATE INDEX IF NOT EXISTS "social_feed_events_type_idx" ON "social_feed_events"("type");
CREATE INDEX IF NOT EXISTS "social_feed_events_createdAt_idx" ON "social_feed_events"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "social_feed_events_productId_idx" ON "social_feed_events"("productId");

-- Share links with referral tracking
CREATE TABLE IF NOT EXISTS "share_links" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "code"        TEXT NOT NULL UNIQUE,
  "clicks"      INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "earnings"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "share_links_code_key" ON "share_links"("code");
CREATE INDEX IF NOT EXISTS "share_links_userId_idx" ON "share_links"("userId");
CREATE INDEX IF NOT EXISTS "share_links_productId_idx" ON "share_links"("productId");

-- UGC Photos (buyer posts photo of received product)
CREATE TABLE IF NOT EXISTS "ugc_photos" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "userName"    TEXT NOT NULL,
  "userAvatar"  TEXT,
  "orderId"     TEXT,
  "productId"   TEXT NOT NULL,
  "photoUrl"    TEXT NOT NULL,
  "caption"     TEXT,
  "likes"       INTEGER NOT NULL DEFAULT 0,
  "isApproved"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ugc_photos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ugc_photos_productId_idx" ON "ugc_photos"("productId");
CREATE INDEX IF NOT EXISTS "ugc_photos_userId_idx" ON "ugc_photos"("userId");
CREATE INDEX IF NOT EXISTS "ugc_photos_createdAt_idx" ON "ugc_photos"("createdAt" DESC);

-- UGC Photo Likes
CREATE TABLE IF NOT EXISTS "ugc_photo_likes" (
  "photoId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ugc_photo_likes_pkey" PRIMARY KEY ("photoId", "userId")
);

-- User Badges
CREATE TABLE IF NOT EXISTS "user_badges" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "badge"     TEXT NOT NULL,
  -- FIRST_PURCHASE | FIVE_ORDERS | ORGANIC_BUYER | TOP_BUYER | UGC_CREATOR
  -- COMMUNITY_BUILDER | LOYAL_CUSTOMER | LIVE_SHOPPER | BULK_BUYER
  "earnedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_badges_unique" ON "user_badges"("userId", "badge");
CREATE INDEX IF NOT EXISTS "user_badges_userId_idx" ON "user_badges"("userId");
