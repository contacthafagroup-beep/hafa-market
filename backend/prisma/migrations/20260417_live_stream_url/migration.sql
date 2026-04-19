DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'live_sessions') THEN
    ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "streamUrl" TEXT;
  END IF;
END $$;
