-- AlterEnum
ALTER TYPE "AuthProvider" ADD VALUE 'GOOGLE';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleId" VARCHAR(255);
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PasswordResetOtp" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "otpHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_email_idx" ON "PasswordResetOtp"("email");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_userId_idx" ON "PasswordResetOtp"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_expiresAt_idx" ON "PasswordResetOtp"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_email_usedAt_expiresAt_idx" ON "PasswordResetOtp"("email", "usedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "PasswordResetOtp" ADD CONSTRAINT "PasswordResetOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
