-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(120),
    "phone" VARCHAR(32),
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
    "refreshTokenHash" VARCHAR(255),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_refreshTokenExpiresAt_idx" ON "User"("refreshTokenExpiresAt");
