-- AlterTable
ALTER TABLE "settings" ADD COLUMN "githubRefreshToken" TEXT;
ALTER TABLE "settings" ADD COLUMN "githubTokenExpiresAt" DATETIME;
