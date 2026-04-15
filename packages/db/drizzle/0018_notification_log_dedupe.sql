ALTER TABLE "notification_log"
  ADD COLUMN IF NOT EXISTS "dedupe_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "notification_log_dedupe_key_unique"
  ON "notification_log" ("dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
