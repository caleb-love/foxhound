-- H1.3: [SECURITY] Make traces.org_id NOT NULL
-- traces.org_id is currently nullable, which means traces can exist without
-- an org association — a multi-tenant isolation bypass risk.
--
-- Strategy: quarantine orphaned rows into a backup table for recovery,
-- then delete and add NOT NULL — all within a single transaction.

BEGIN;

-- Step 1: Quarantine orphaned traces for potential recovery
CREATE TABLE IF NOT EXISTS "_orphaned_traces_backup" (LIKE "traces" INCLUDING ALL);
INSERT INTO "_orphaned_traces_backup"
  SELECT * FROM "traces" WHERE "org_id" IS NULL
  ON CONFLICT DO NOTHING;

-- Step 2: Delete orphaned traces (now safely backed up)
DELETE FROM "traces" WHERE "org_id" IS NULL;

-- Step 3: Add NOT NULL constraint (atomic with the delete)
ALTER TABLE "traces"
  ALTER COLUMN "org_id" SET NOT NULL;

-- Step 4: Add FK constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'traces_org_id_organizations_id_fk'
      AND table_name = 'traces'
  ) THEN
    ALTER TABLE "traces"
      ADD CONSTRAINT "traces_org_id_organizations_id_fk"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id");
  END IF;
END $$;

COMMIT;
