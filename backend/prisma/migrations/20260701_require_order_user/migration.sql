INSERT INTO "User" (
  "id",
  "email",
  "name",
  "role",
  "authProvider",
  "isActive",
  "emailVerified",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('belikeme-archived-orders-owner')::uuid,
  'archived-orders@belikeme.invalid',
  'Archived orders',
  'CUSTOMER'::"UserRole",
  'EMAIL'::"AuthProvider",
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Order" WHERE "userId" IS NULL)
ON CONFLICT ("email") DO NOTHING;

UPDATE "User"
SET
  "name" = 'Archived orders',
  "passwordHash" = NULL,
  "googleId" = NULL,
  "role" = 'CUSTOMER'::"UserRole",
  "authProvider" = 'EMAIL'::"AuthProvider",
  "isActive" = false,
  "emailVerified" = true,
  "refreshTokenHash" = NULL,
  "refreshTokenExpiresAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "email" = 'archived-orders@belikeme.invalid';

UPDATE "Order"
SET "userId" = (
  SELECT "id"
  FROM "User"
  WHERE "email" = 'archived-orders@belikeme.invalid'
)
WHERE "userId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Order" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require order ownership because archival ownership could not be established.';
  END IF;
END $$;

ALTER TABLE "Order"
DROP COLUMN "guestEmail",
ALTER COLUMN "userId" SET NOT NULL;
