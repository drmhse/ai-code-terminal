#!/bin/bash

# Fix permissions BEFORE switching to claude user
echo "Setting up permissions..."
chown -R claude:claude /app/prisma/data
chown -R claude:claude /app/workspaces
chown -R claude:claude /home/claude

# Ensure database directory exists with correct permissions
mkdir -p /app/prisma/data
chmod 755 /app/prisma/data

# If database exists, ensure it's writable
if [ -f /app/prisma/data/database.db ]; then
    chmod 664 /app/prisma/data/database.db
    chown claude:claude /app/prisma/data/database.db
fi

# Now switch to claude user and start the app
cd /app
exec su-exec claude /bin/bash ./start.sh
