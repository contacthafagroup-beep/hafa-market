-- Add fraud detection fields to reviews table
ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fraudFlags"   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "moderationStatus" TEXT NOT NULL DEFAULT 'APPROVED';
  -- moderationStatus: APPROVED | FLAGGED | HIDDEN | DISMISSED

CREATE INDEX IF NOT EXISTS "reviews_isSuspicious_idx" ON "reviews"("isSuspicious");
CREATE INDEX IF NOT EXISTS "reviews_moderationStatus_idx" ON "reviews"("moderationStatus");
