-- Additive payment reconciliation types and ledger. No existing rows are changed.
CREATE TYPE "PaymentReconciliationIssueType" AS ENUM (
  'LATE_PROVIDER_PAID',
  'PAID_AFTER_LOCAL_CANCELLED',
  'PAID_AFTER_LOCAL_EXPIRED',
  'PAID_STOCK_SHORTAGE',
  'PROVIDER_LOCAL_STATUS_MISMATCH'
);

CREATE TYPE "PaymentReconciliationIssueStatus" AS ENUM (
  'OPEN',
  'REVIEWING',
  'RESOLVED',
  'REFUND_REQUIRED',
  'REFUNDED',
  'FULFILLMENT_REQUIRED'
);

CREATE TABLE "PaymentReconciliationIssue" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "type" "PaymentReconciliationIssueType" NOT NULL,
  "status" "PaymentReconciliationIssueStatus" NOT NULL DEFAULT 'OPEN',
  "provider" "PaymentProvider" NOT NULL,
  "providerOrderCode" INTEGER NOT NULL,
  "providerPaymentLinkId" VARCHAR(120),
  "providerTransactionReference" VARCHAR(120),
  "amount" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "safeReason" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" UUID,
  "adminNote" VARCHAR(1000),
  CONSTRAINT "PaymentReconciliationIssue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentReconciliationIssue_paymentId_type_key"
  ON "PaymentReconciliationIssue"("paymentId", "type");
CREATE INDEX "PaymentReconciliationIssue_orderId_status_idx"
  ON "PaymentReconciliationIssue"("orderId", "status");
CREATE INDEX "PaymentReconciliationIssue_provider_providerOrderCode_idx"
  ON "PaymentReconciliationIssue"("provider", "providerOrderCode");
CREATE INDEX "PaymentReconciliationIssue_status_createdAt_idx"
  ON "PaymentReconciliationIssue"("status", "createdAt");

ALTER TABLE "PaymentReconciliationIssue"
  ADD CONSTRAINT "PaymentReconciliationIssue_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReconciliationIssue"
  ADD CONSTRAINT "PaymentReconciliationIssue_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
