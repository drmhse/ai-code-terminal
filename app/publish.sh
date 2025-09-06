#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# Your Docker Hub username or organization
DOCKER_USERNAME="editoredit"

# The name of the repository on Docker Hub
REPO_NAME="act"

# The name of the service in your docker-compose.yml file
SERVICE_NAME="act"

# The project name used by Docker Compose. By default, it's the name of the
# directory containing your docker-compose.yml file.
# If your directory is named 'app', the image will be 'app-act'.
# Change this if your directory name is different or you use `docker compose -p <name>`.
COMPOSE_PROJECT_NAME=$(basename "$PWD")
# --- End of Configuration ---


# 1. Check for version tag argument
if [ -z "$1" ]; then
  echo "❌ Error: No version tag provided."
  echo "Usage: ./publish.sh <version>"
  echo "Example: ./publish.sh 1.0.0"
  exit 1
fi

VERSION=$1
LOCAL_IMAGE="${COMPOSE_PROJECT_NAME}-${SERVICE_NAME}:latest"
REMOTE_IMAGE_VERSIONED="${DOCKER_USERNAME}/${REPO_NAME}:${VERSION}"
REMOTE_IMAGE_LATEST="${DOCKER_USERNAME}/${REPO_NAME}:latest"

# 2. Build the Docker image using Docker Compose
echo "🚀 Step 1/4: Building Docker image for service '${SERVICE_NAME}'..."
docker compose build ${SERVICE_NAME}
echo "✅ Build complete. Local image is named: ${LOCAL_IMAGE}"

# 3. Tag the image for Docker Hub
echo "🏷️ Step 2/4: Tagging image..."
docker tag "${LOCAL_IMAGE}" "${REMOTE_IMAGE_VERSIONED}"
docker tag "${LOCAL_IMAGE}" "${REMOTE_IMAGE_LATEST}"
echo "   - Tagged as: ${REMOTE_IMAGE_VERSIONED}"
echo "   - Tagged as: ${REMOTE_IMAGE_LATEST}"

# 4. Prompt user to confirm before pushing
echo "📦 Step 3/4: Ready to push to Docker Hub."
echo "   The following tags will be pushed:"
echo "   - ${REMOTE_IMAGE_VERSIONED}"
echo "   - ${REMOTE_IMAGE_LATEST}"
read -p "   Do you want to continue? (y/N) " -n 1 -r
echo # Move to a new line

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "🚫 Push cancelled by user."
    exit 1
fi

# 5. Push the images to Docker Hub
echo "☁️ Step 4/4: Pushing images to Docker Hub..."
echo "(You must be logged in with 'docker login' for this to work)"
docker push "${REMOTE_IMAGE_VERSIONED}"
docker push "${REMOTE_IMAGE_LATEST}"

echo "🎉 Success! Image has been published to Docker Hub."
echo "   View it here: https://hub.docker.com/r/${DOCKER_USERNAME}/${REPO_NAME}/tags"
