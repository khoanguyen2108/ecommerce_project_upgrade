-- Add nullable delivery snapshot fields so historical orders remain readable.
ALTER TABLE "Order"
ADD COLUMN "shippingRecipientName" VARCHAR(120),
ADD COLUMN "shippingPhone" VARCHAR(20),
ADD COLUMN "shippingProvince" VARCHAR(120),
ADD COLUMN "shippingDistrict" VARCHAR(120),
ADD COLUMN "shippingWard" VARCHAR(120),
ADD COLUMN "shippingAddressLine" VARCHAR(255),
ADD COLUMN "shippingNote" VARCHAR(500);

CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recipientName" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "province" VARCHAR(120) NOT NULL,
    "district" VARCHAR(120) NOT NULL,
    "ward" VARCHAR(120) NOT NULL,
    "addressLine" VARCHAR(255) NOT NULL,
    "note" VARCHAR(500),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Address_userId_createdAt_idx" ON "Address"("userId", "createdAt");
CREATE INDEX "Address_userId_isDefault_idx" ON "Address"("userId", "isDefault");
CREATE UNIQUE INDEX "Address_one_default_per_user_idx"
ON "Address"("userId") WHERE "isDefault" = true;

ALTER TABLE "Address"
ADD CONSTRAINT "Address_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
