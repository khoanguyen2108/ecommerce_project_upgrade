DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Order" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require order ownership while unowned orders remain. Archive or assign those records before applying this migration.';
  END IF;
END $$;

ALTER TABLE "Order"
DROP COLUMN "guestEmail",
ALTER COLUMN "userId" SET NOT NULL;
