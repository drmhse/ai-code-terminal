/*
  Warnings:

  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `userId` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `workspaces` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_githubId_key";

-- DropIndex
DROP INDEX "users_email_key";

-- DropIndex
DROP INDEX "users_username_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "users";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "githubToken" TEXT,
    "claudeToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shellPid" INTEGER,
    "socketId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "workspaceId" TEXT,
    CONSTRAINT "sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("createdAt", "endedAt", "id", "lastActivityAt", "shellPid", "socketId", "status", "workspaceId") SELECT "createdAt", "endedAt", "id", "lastActivityAt", "shellPid", "socketId", "status", "workspaceId" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE TABLE "new_workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "githubRepo" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_workspaces" ("createdAt", "githubRepo", "githubUrl", "id", "isActive", "lastSyncAt", "localPath", "name", "updatedAt") SELECT "createdAt", "githubRepo", "githubUrl", "id", "isActive", "lastSyncAt", "localPath", "name", "updatedAt" FROM "workspaces";
DROP TABLE "workspaces";
ALTER TABLE "new_workspaces" RENAME TO "workspaces";
CREATE UNIQUE INDEX "workspaces_githubRepo_key" ON "workspaces"("githubRepo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
