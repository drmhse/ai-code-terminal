-- CreateTable
CREATE TABLE "terminal_layouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "layoutType" TEXT NOT NULL DEFAULT 'tabs',
    "configuration" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "terminal_layouts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "sessionName" TEXT NOT NULL DEFAULT 'Terminal',
    "sessionType" TEXT NOT NULL DEFAULT 'terminal',
    "isDefaultSession" BOOLEAN NOT NULL DEFAULT false,
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
    "layoutId" TEXT,
    "workspaceId" TEXT,
    CONSTRAINT "sessions_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "terminal_layouts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("autoCleanup", "canRecover", "createdAt", "currentWorkingDir", "endedAt", "environmentVars", "id", "lastActivityAt", "lastCommand", "maxIdleTime", "recoveryToken", "sessionTimeout", "shellHistory", "shellPid", "socketId", "status", "terminalSize", "workspaceId") SELECT "autoCleanup", "canRecover", "createdAt", "currentWorkingDir", "endedAt", "environmentVars", "id", "lastActivityAt", "lastCommand", "maxIdleTime", "recoveryToken", "sessionTimeout", "shellHistory", "shellPid", "socketId", "status", "terminalSize", "workspaceId" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE INDEX "sessions_recoveryToken_idx" ON "sessions"("recoveryToken");
CREATE INDEX "sessions_status_idx" ON "sessions"("status");
CREATE INDEX "sessions_lastActivityAt_idx" ON "sessions"("lastActivityAt");
CREATE INDEX "sessions_workspaceId_isDefaultSession_idx" ON "sessions"("workspaceId", "isDefaultSession");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "terminal_layouts_workspaceId_isDefault_idx" ON "terminal_layouts"("workspaceId", "isDefault");
