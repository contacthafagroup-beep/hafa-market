CREATE TABLE IF NOT EXISTS "live_sessions" (
  "id"           TEXT NOT NULL,
  "sellerId"     TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "status"       TEXT NOT NULL DEFAULT 'SCHEDULED',
  "streamUrl"    TEXT,
  "thumbnailUrl" TEXT,
  "viewerCount"  INTEGER NOT NULL DEFAULT 0,
  "peakViewers"  INTEGER NOT NULL DEFAULT 0,
  "productIds"   TEXT[] DEFAULT '{}',
  "scheduledAt"  TIMESTAMP(3),
  "startedAt"    TIMESTAMP(3),
  "endedAt"      TIMESTAMP(3),
  "highlights"   JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "live_sessions_sellerId_idx" ON "live_sessions"("sellerId");
CREATE INDEX IF NOT EXISTS "live_sessions_status_idx" ON "live_sessions"("status");
ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "streamUrl" TEXT;