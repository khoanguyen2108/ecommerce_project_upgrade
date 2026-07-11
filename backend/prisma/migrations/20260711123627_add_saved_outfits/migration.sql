-- CreateTable
CREATE TABLE "SavedOutfit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sourcePrompt" VARCHAR(500) NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "totalPriceSnapshot" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedOutfit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedOutfit_userId_createdAt_idx" ON "SavedOutfit"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SavedOutfit" ADD CONSTRAINT "SavedOutfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
