-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "imageUrl" VARCHAR(2048),
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "featuredOrder" INTEGER;

-- CreateTable
CREATE TABLE "LandingPageSetting" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "heroImageUrl" VARCHAR(2048),
    "heroEyebrow" VARCHAR(120),
    "heroTitle" VARCHAR(160),
    "heroSubtitle" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPageSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_featuredOrder_key" ON "Category"("featuredOrder");

-- CreateIndex
CREATE INDEX "Category_isActive_isFeatured_featuredOrder_idx"
ON "Category"("isActive", "isFeatured", "featuredOrder");
