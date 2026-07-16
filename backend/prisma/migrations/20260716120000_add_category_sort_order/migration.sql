-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing categories into a stable storefront order.
WITH ordered_categories AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) - 1 AS "nextSortOrder"
  FROM "Category"
)
UPDATE "Category"
SET "sortOrder" = ordered_categories."nextSortOrder"
FROM ordered_categories
WHERE "Category"."id" = ordered_categories."id";

-- CreateIndex
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");
