-- Social Commerce Posts
CREATE TABLE IF NOT EXISTS "social_posts" (
  "id"           TEXT NOT NULL,
  "sellerId"     TEXT NOT NULL,
  "type"         TEXT NOT NULL DEFAULT 'IMAGE',  -- IMAGE | VIDEO
  "mediaUrl"     TEXT NOT NULL,
  "thumbnailUrl" TEXT NOT NULL,
  "caption"      TEXT,
  "captionAm"    TEXT,
  "status"       TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | HIDDEN | DELETED
  "views"        INTEGER NOT NULL DEFAULT 0,
  "clicks"       INTEGER NOT NULL DEFAULT 0,
  "cartAdds"     INTEGER NOT NULL DEFAULT 0,
  "purchases"    INTEGER NOT NULL DEFAULT 0,
  "score"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "social_posts_sellerId_idx" ON "social_posts"("sellerId");
CREATE INDEX IF NOT EXISTS "social_posts_score_idx" ON "social_posts"("score" DESC);
CREATE INDEX IF NOT EXISTS "social_posts_createdAt_idx" ON "social_posts"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "social_posts_status_idx" ON "social_posts"("status");

-- Post ↔ Product tags (which products are in this post)
CREATE TABLE IF NOT EXISTS "post_products" (
  "id"        TEXT NOT NULL,
  "postId"    TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "tagX"      DOUBLE PRECISION,  -- % position on media (0-100)
  "tagY"      DOUBLE PRECISION,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "post_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "post_products_unique" UNIQUE ("postId", "productId")
);
CREATE INDEX IF NOT EXISTS "post_products_postId_idx" ON "post_products"("postId");
CREATE INDEX IF NOT EXISTS "post_products_productId_idx" ON "post_products"("productId");

-- Post interactions (feed ranking signals)
CREATE TABLE IF NOT EXISTS "post_interactions" (
  "id"        TEXT NOT NULL,
  "postId"    TEXT NOT NULL,
  "userId"    TEXT,
  "type"      TEXT NOT NULL,  -- VIEW | CLICK | CART_ADD | PURCHASE
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "post_interactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "post_interactions_postId_type_idx" ON "post_interactions"("postId", "type");
CREATE INDEX IF NOT EXISTS "post_interactions_createdAt_idx" ON "post_interactions"("createdAt" DESC);
