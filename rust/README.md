# AI Code Terminal - Rust Backend

High-performance, self-contained backend for the AI Code Terminal, built with Rust for maximum efficiency and reliability.

## Quick Start

1. **Setup Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Install SQLx CLI** (if not already installed):
   ```bash
   cargo install sqlx-cli --no-default-features --features sqlite
   ```

3. **Run Database Migrations**:
   ```bash
   cd crates/act-server
   sqlx migrate run
   ```

4. **Build and Run**:
   ```bash
   cargo build --release
   cargo run --bin act-server
   ```

## Architecture

- **`act-core`**: Shared library with database and error handling
- **`act-server`**: Main binary with API endpoints and WebSocket server
- **SQLite Database**: Lightweight, zero-configuration persistence
- **Socket.IO Protocol**: Real-time terminal communication
- **Portable PTY**: Cross-platform terminal process management

## API Endpoints

- `GET /api/v1/health` - Health check
- `GET /api/v1/workspaces` - List workspaces
- `POST /api/v1/workspaces` - Create workspace
- `DELETE /api/v1/workspaces/:id` - Delete workspace
- `GET /api/v1/sessions` - List terminal sessions
- `POST /api/v1/sessions` - Create terminal session

## WebSocket Events

- `terminal:create` - Create new terminal session
- `terminal:data` - Send input to terminal
- `terminal:resize` - Resize terminal
- `terminal:destroy` - Terminate terminal session
- `terminal:output` - Receive terminal output
- `terminal:created` - Terminal creation confirmation
- `terminal:destroyed` - Terminal destruction confirmation

## Configuration

All configuration is handled via environment variables with the `ACT_` prefix:

- `ACT_SERVER_HOST` - Server bind address (default: 0.0.0.0)
- `ACT_SERVER_PORT` - Server port (default: 3001)
- `ACT_DATABASE_URL` - SQLite database path
- `ACT_AUTH_JWT_SECRET` - JWT signing secret
- `ACT_AUTH_GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `ACT_AUTH_GITHUB_CLIENT_SECRET` - GitHub OAuth client secret
- `ACT_CORS_ALLOWED_ORIGINS` - Comma-separated allowed origins

## Development

```bash
# Watch mode with auto-reload
cargo watch -x "run --bin act-server"

# Run tests
cargo test

# Check code
cargo clippy
cargo fmt
```