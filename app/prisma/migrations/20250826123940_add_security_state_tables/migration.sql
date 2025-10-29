-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientIp" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "requestTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "csrf_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "rate_limits_clientIp_keyPrefix_idx" ON "rate_limits"("clientIp", "keyPrefix");

-- CreateIndex
CREATE INDEX "rate_limits_expiresAt_idx" ON "rate_limits"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "csrf_tokens_token_key" ON "csrf_tokens"("token");

-- CreateIndex
CREATE INDEX "csrf_tokens_token_idx" ON "csrf_tokens"("token");

-- CreateIndex
CREATE INDEX "csrf_tokens_expiresAt_idx" ON "csrf_tokens"("expiresAt");
