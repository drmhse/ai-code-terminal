# AI Code Terminal - Desktop Application

This directory contains the Tauri-based desktop application that packages the AI Code Terminal web application with a local backend server.

## Architecture

The desktop application maintains the client-server model:

1. **Frontend**: The same Vue.js web application from `../../frontend`
2. **Backend**: Launches the Rust backend server from `../../backend` as a subprocess
3. **Communication**: HTTP/WebSocket between frontend and locally running backend

## Development

### Prerequisites

- Rust 1.75+
- Node.js 20+
- Cargo workspace structure in parent directories

### Running in Development Mode

```bash
cd rust/desktop
npm install
npm run tauri:dev
```

This will:
1. Copy `.env.desktop` to `.env` in the frontend directory
2. Start the Vite dev server for the frontend
3. Launch the Tauri app with development hot-reload
4. Auto-start the backend server when the Tauri app initializes

### Building for Production

```bash
cd rust/desktop
npm run tauri:build
```

This will:
1. Build the frontend for production
2. Bundle the frontend into the Tauri app
3. Create platform-specific executable/installer

## Configuration

### Backend Configuration

The backend server is automatically configured with desktop-appropriate settings:

- **Host**: `127.0.0.1` (localhost only)
- **Port**: `3001` (configurable in `src-tauri/src/lib.rs`)
- **Database**: SQLite in user's data directory
- **Workspaces**: User's Documents directory
- **CORS**: Allows `tauri://localhost` and `http://localhost:3000`

### Frontend Configuration

The frontend uses the `.env.desktop` file which sets:

- `VITE_API_BASE_URL=http://localhost:3001`
- `VITE_WS_URL=http://localhost:3001`
- `VITE_DESKTOP_APP=true` (for desktop-specific UI logic)

## File Structure

```
desktop/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs           # Main Tauri application logic
│   │   └── main.rs          # Entry point
│   ├── Cargo.toml           # Rust dependencies
│   ├── tauri.conf.json      # Tauri configuration
│   ├── capabilities/        # Security capabilities
│   └── icons/               # App icons
├── package.json             # Node.js dependencies
└── README.md                # This file
```

## Security Considerations

- Backend runs with user's permissions
- Database stored in user's data directory
- No network exposure (localhost only)
- Desktop-specific JWT secrets generated per session

## Deployment Targets

The build configuration supports:
- **Windows**: `.exe` installer
- **macOS**: `.dmg` installer
- **Linux**: `.deb` and `.AppImage` packages

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Troubleshooting

### Backend fails to start
- Ensure Rust toolchain is properly installed
- Check that backend code compiles: `cd ../../backend && cargo check`
- Verify environment variables are set correctly

### Frontend connection issues
- Check that `.env.desktop` is properly configured
- Verify backend is running on correct port
- Check CORS configuration in tauri.conf.json

### Build failures
- Ensure all Node.js dependencies are installed
- Verify Rust toolchain is up to date
- Check platform-specific build requirements
