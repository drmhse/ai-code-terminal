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
    "currentWorkingDir" TEXT,
    "environmentVars" TEXT,
    "shellHistory" TEXT,
    "terminalSize" TEXT,
    "lastCommand" TEXT,
    "sessionTimeout" INTEGER,
    "recoveryToken" TEXT,
    "canRecover" BOOLEAN NOT NULL DEFAULT true,
    "maxIdleTime" INTEGER NOT NULL DEFAULT 1440,
    "autoCleanup" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT,
    CONSTRAINT "sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("createdAt", "endedAt", "id", "lastActivityAt", "shellPid", "socketId", "status", "workspaceId") SELECT "createdAt", "endedAt", "id", "lastActivityAt", "shellPid", "socketId", "status", "workspaceId" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE INDEX "sessions_recoveryToken_idx" ON "sessions"("recoveryToken");
CREATE INDEX "sessions_status_idx" ON "sessions"("status");
CREATE INDEX "sessions_lastActivityAt_idx" ON "sessions"("lastActivityAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
