-- Add estimatedAt to deliveries table
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "estimatedAt" TIMESTAMP(3);
