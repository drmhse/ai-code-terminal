# Multi-stage build for Rust backend with PTY support

# Stage 1: Builder
FROM debian:bookworm AS builder

# Install Rust and build dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /usr/src/app

# Copy source code
COPY . .

# Build release binary
RUN cargo build --release

# Stage 2: Runtime - Same base OS for GLIBC compatibility
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies for PTY support
RUN apt-get update && apt-get install -y \
    sqlite3 \
    libsqlite3-dev \
    ca-certificates \
    curl \
    bash \
    coreutils \
    procps \
    git \
    && rm -rf /var/lib/apt/lists/*

# Ensure PTY devices are available
RUN mkdir -p /dev/pts && \
    chmod 755 /dev/pts

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /bin/bash appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /usr/src/app/target/release/act-server /usr/local/bin/act-server

# Make binary executable
RUN chmod +x /usr/local/bin/act-server

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/workspaces /app/logs && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 3001

CMD ["/usr/local/bin/act-server"]
