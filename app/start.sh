#!/bin/bash

# Database migration and startup script
echo "Starting Claude Code Web Interface..."

# Run Prisma migrations first
echo "Running database migrations..."
npx prisma migrate deploy

# Skip Prisma generate - already done in Dockerfile
echo "Prisma client already generated during build..."

# Start the application
echo "Starting server..."
exec node server.js