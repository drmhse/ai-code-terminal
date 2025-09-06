# Stage 1: Frontend build
FROM node:22-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./
COPY frontend/tsconfig*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/src ./src
COPY frontend/vite.config.ts ./

# Build frontend assets
RUN npm run build

# Stage 2: Backend builder
FROM node:22-alpine AS backend-builder

# Install build-time system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    py3-setuptools

WORKDIR /app

# Copy package files
COPY app/package.json ./
COPY app/package-lock.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Stage 3: Main application
FROM node:22-alpine

# Install runtime system dependencies
RUN apk add --no-cache \
    openssl-dev \
    git \
    bash \
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

# Install Claude Code and act CLI globally (requires root)
RUN npm install -g @anthropic-ai/claude-code @drmhse/act-cli

WORKDIR /app

# Create necessary directories and set permissions
RUN mkdir -p workspaces prisma/data data logs && \
    chown -R claude:claude /home/claude && \
    chown -R claude:claude /app

# Copy node_modules from builder stage
COPY --from=backend-builder /app/node_modules ./node_modules

# Copy application code
COPY app/ .

# Copy built frontend assets from previous stage
COPY --from=frontend-builder /frontend/dist ./public/dist

# Make startup script executable
RUN chmod +x start.sh

# Run Prisma generate as root (before switching users)
RUN npx prisma generate

# Setup bash environment for claude user
RUN echo 'export PS1="[\u@\h]:[\w]$ "' >> /home/claude/.bashrc && \
    echo 'export PATH=$PATH:/home/claude/.local/bin' >> /home/claude/.bashrc && \
    echo 'alias ll="ls -la"' >> /home/claude/.bashrc && \
    echo 'alias gs="git status"' >> /home/claude/.bashrc && \
    echo 'alias gd="git diff"' >> /home/claude/.bashrc && \
    echo 'alias ga="git add"' >> /home/claude/.bashrc && \
    echo 'alias gc="git commit"' >> /home/claude/.bashrc && \
    echo 'alias gp="git push"' >> /home/claude/.bashrc && \
    echo 'alias gl="git log --oneline"' >> /home/claude/.bashrc && \
    echo 'cd /app/workspaces 2>/dev/null || cd /app' >> /home/claude/.bashrc && \
    echo 'echo "Welcome to Claude Code Terminal!"' >> /home/claude/.bashrc && \
    echo 'echo "🚀 act-cli is available! Try: act context add <file>, act context --help"' >> /home/claude/.bashrc && \
    chown claude:claude /home/claude/.bashrc

COPY app/init.sh /init.sh
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
