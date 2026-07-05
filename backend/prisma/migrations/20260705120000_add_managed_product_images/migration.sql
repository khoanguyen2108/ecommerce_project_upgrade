-- CreateEnum
CREATE TYPE "AssetProvider" AS ENUM ('SUPABASE');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'DELETE_FAILED');

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" UUID NOT NULL,
    "provider" "AssetProvider" NOT NULL DEFAULT 'SUPABASE',
    "bucket" VARCHAR(100) NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "publicUrl" VARCHAR(2048) NOT NULL,
    "originalFilename" VARCHAR(255),
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" VARCHAR(64),
    "uploadedById" UUID NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "imageAssetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_provider_bucket_storagePath_key" ON "ImageAsset"("provider", "bucket", "storagePath");

-- CreateIndex
CREATE INDEX "ImageAsset_uploadedById_createdAt_idx" ON "ImageAsset"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "ImageAsset_status_idx" ON "ImageAsset"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_imageAssetId_key" ON "ProductImage"("imageAssetId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
