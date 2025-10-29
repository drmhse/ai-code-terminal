#!/bin/bash
set -e

echo "🚀 Building frontend with Vite + TypeScript..."

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Make sure you're in the frontend directory."
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Type check
echo "🔍 Running TypeScript type check..."
npm run type-check

# Build the project
echo "🔨 Building project..."
npm run build

echo "✅ Frontend build complete!"
echo "📁 Output: $(pwd)/dist/"

# List built files
echo "📄 Built files:"
ls -la dist/

echo ""
echo "🔗 To test with the app:"
echo "1. Make sure symlink exists: ln -sf ../../frontend/dist ../app/public/dist"
echo "2. Start the Express server from app directory"