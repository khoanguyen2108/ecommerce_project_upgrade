-- CreateTable
CREATE TABLE "LandingGalleryImage" (
    "id" UUID NOT NULL,
    "imageUrl" VARCHAR(1000) NOT NULL,
    "title" VARCHAR(80),
    "caption" VARCHAR(160),
    "altText" VARCHAR(160),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingGalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingGalleryImage_isActive_idx" ON "LandingGalleryImage"("isActive");

-- CreateIndex
CREATE INDEX "LandingGalleryImage_sortOrder_idx" ON "LandingGalleryImage"("sortOrder");
