# Dockerfile
FROM node:20-alpine

# Install essential development tools
RUN apk add --no-cache \
    openssl-dev \
    git \
    bash \
    python3 \
    py3-pip \
    make \
    g++ \
    sqlite \
    openssh-client \
    curl \
    jq \
    tzdata

# Set timezone to GMT+3 (Europe/Istanbul)
ENV TZ=Europe/Istanbul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create a non-root user with consistent UID (using 1001 to avoid conflict)
RUN addgroup -g 1001 claude && adduser -u 1001 -G claude -h /home/claude -s /bin/bash -D claude

# Install Claude Code globally (requires root)
RUN npm install -g @anthropic-ai/claude-code

# Build application in /app
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application code
COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Run Prisma generate as root (before switching users)
RUN npx prisma generate

# Create necessary directories and set permissions
RUN mkdir -p workspaces prisma/data data && \
    chown -R claude:claude /home/claude && \
    chown -R claude:claude /app

COPY init.sh /init.sh
RUN chmod +x /init.sh

# Install su-exec for user switching
RUN apk add --no-cache su-exec


# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3014/health || exit 1

# Expose port
EXPOSE 3014

# Override base image entrypoint and start the application
ENTRYPOINT ["/init.sh"]
