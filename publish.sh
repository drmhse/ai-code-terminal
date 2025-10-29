#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
DOCKER_USERNAME="editoredit"
REPO_NAME="act"
DOCKERFILE_PATH="app/Dockerfile" # Path to your Dockerfile
BUILD_CONTEXT="."                # The build context directory
# --- End of Configuration ---

# 1. Check for version tag argument
if [ -z "$1" ]; then
  echo "❌ Error: No version tag provided."
  echo "Usage: ./publish.sh <version>"
  echo "Example: ./publish.sh 1.0.1"
  exit 1
fi

VERSION=$1
REMOTE_IMAGE_VERSIONED="${DOCKER_USERNAME}/${REPO_NAME}:${VERSION}"
REMOTE_IMAGE_LATEST="${DOCKER_USERNAME}/${REPO_NAME}:latest"

# 2. Ensure the multi-platform builder is available and ready
echo "🛠️ Step 1/3: Setting up Docker Buildx builder..."
if ! docker buildx ls | grep -q "multi-platform-builder"; then
  docker buildx create --name multi-platform-builder --use
else
  docker buildx use multi-platform-builder
fi
docker buildx inspect --bootstrap

# 3. Build and push the multi-platform image
echo "🚀 Step 2/3: Building and pushing multi-platform image..."
echo "   This may take longer as it's building for multiple architectures."

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "${REMOTE_IMAGE_VERSIONED}" \
  --tag "${REMOTE_IMAGE_LATEST}" \
  --file "${DOCKERFILE_PATH}" \
  --push \
  "${BUILD_CONTEXT}"

# 4. Final confirmation
echo "🎉 Step 3/3: Success! Multi-platform image has been published."
echo "   It now supports both AMD64 (servers) and ARM64 (Apple Silicon)."
echo "   View it here: https://hub.docker.com/r/${DOCKER_USERNAME}/${REPO_NAME}/tags"
