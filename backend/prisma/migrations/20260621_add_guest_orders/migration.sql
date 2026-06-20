-- Allow orders without a customer account and retain an optional guest contact email.
-- Existing customer orders and their user relations remain unchanged.
ALTER TABLE "Order"
ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "guestEmail" VARCHAR(320);
