-- CreateTable
CREATE TABLE "user_processes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pid" INTEGER NOT NULL,
    "command" TEXT NOT NULL,
    "args" TEXT,
    "cwd" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "exitCode" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoRestart" BOOLEAN NOT NULL DEFAULT false,
    "restartCount" INTEGER NOT NULL DEFAULT 0,
    "sessionId" TEXT,
    "workspaceId" TEXT,
    CONSTRAINT "user_processes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_processes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_processes_pid_idx" ON "user_processes"("pid");

-- CreateIndex
CREATE INDEX "user_processes_status_idx" ON "user_processes"("status");

-- CreateIndex
CREATE INDEX "user_processes_sessionId_idx" ON "user_processes"("sessionId");

-- CreateIndex
CREATE INDEX "user_processes_workspaceId_idx" ON "user_processes"("workspaceId");
