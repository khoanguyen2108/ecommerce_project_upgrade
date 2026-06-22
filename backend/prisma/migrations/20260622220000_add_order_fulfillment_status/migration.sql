CREATE TYPE "OrderFulfillmentStatus" AS ENUM (
  'PENDING',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
);

ALTER TABLE "Order"
  ADD COLUMN "fulfillmentStatus" "OrderFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "fulfilledAt" TIMESTAMP(3);

CREATE INDEX "Order_fulfillmentStatus_idx" ON "Order"("fulfillmentStatus");
