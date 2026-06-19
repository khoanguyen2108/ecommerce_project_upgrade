ALTER TABLE "Order"
ADD COLUMN "voucherId" UUID,
ADD COLUMN "voucherCodeSnapshot" VARCHAR(64),
ADD COLUMN "voucherNameSnapshot" VARCHAR(160),
ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Order_voucherId_idx" ON "Order"("voucherId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_voucherId_fkey"
FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
