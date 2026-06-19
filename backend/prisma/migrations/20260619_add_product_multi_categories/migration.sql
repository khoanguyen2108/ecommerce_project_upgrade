-- Preserve Product.categoryId as the primary/default category while adding
-- explicit many-to-many category membership.
CREATE TABLE "ProductCategory" (
    "productId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId", "categoryId")
);

CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

ALTER TABLE "ProductCategory"
ADD CONSTRAINT "ProductCategory_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductCategory"
ADD CONSTRAINT "ProductCategory_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ProductCategory" ("productId", "categoryId")
SELECT "id", "categoryId"
FROM "Product"
ON CONFLICT ("productId", "categoryId") DO NOTHING;
