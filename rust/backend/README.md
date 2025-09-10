# ACT Rust Backend

This is the Rust backend for the AI Coding Terminal (ACT) project.

## Structure

This workspace contains multiple crates:

- **act-core**: Core types, traits, and shared functionality
- **act-pty**: PTY (pseudo-terminal) service for terminal emulation
- **act-vfs**: Virtual file system with sandboxing
- **act-domain**: Domain logic and business rules
- **act-persistence**: Database repositories and persistence layer
- **act-server**: Main web server (default binary)
- **act-cli**: Command-line interface tool

## Running the Applications

### Using the run script (recommended)

```bash
# Start the server (default)
./run.sh

# Start the server explicitly
./run.sh server

# Run the CLI
./run.sh cli

# Show CLI help
./run.sh cli help

# Create a workspace
./run.sh cli create-workspace my-project

# List workspaces
./run.sh cli list-workspaces
```

### Using cargo directly

```bash
# Start the server (default due to workspace configuration)
cargo run

# Start the server explicitly
cargo run --package act-server

# Run the CLI
cargo run --package act-cli -- --help

# Create a workspace
cargo run --package act-cli -- create-workspace my-project
```

## Development

### Type Checking

Run type checking with clippy:

```bash
cargo clippy --all-targets --all-features -- -D warnings
```

### Building

Build in release mode:

```bash
cargo build --release
```

### Testing

Run tests:

```bash
cargo test
```

## Configuration

The default application for `cargo run` is set to `act-server` in the workspace `Cargo.toml`. This eliminates confusion when running the project.

## Environment Variables

- `RUST_LOG`: Control logging level (e.g., `RUST_LOG=debug`)
- `DATABASE_URL`: Database connection string
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth client secret