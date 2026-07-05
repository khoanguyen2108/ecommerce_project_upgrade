-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "managedImageAssetId" UUID;

-- AlterTable
ALTER TABLE "LandingGalleryImage"
ALTER COLUMN "imageUrl" DROP NOT NULL,
ADD COLUMN "managedImageAssetId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Category_managedImageAssetId_key" ON "Category"("managedImageAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingGalleryImage_managedImageAssetId_key" ON "LandingGalleryImage"("managedImageAssetId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_managedImageAssetId_fkey" FOREIGN KEY ("managedImageAssetId") REFERENCES "ImageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingGalleryImage" ADD CONSTRAINT "LandingGalleryImage_managedImageAssetId_fkey" FOREIGN KEY ("managedImageAssetId") REFERENCES "ImageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
