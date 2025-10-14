# AI Code Terminal - Desktop App

This directory contains the Tauri desktop application wrapper for AI Code Terminal.

## Architecture

The desktop app consists of:
- **Tauri wrapper** (`src-tauri/`): Rust code that manages the backend server and provides native OS integration
- **Frontend** (from `../frontend/`): Vue.js application that provides the UI
- **Backend** (from `../backend/`): Rust server that handles all business logic

## How It Works

### Development Mode
When you run the desktop app in dev mode:
1. Tauri starts the frontend dev server from `../frontend` on port 5173
2. The Tauri window opens and loads the frontend
3. The Tauri Rust code automatically:
   - Finds an available port (5500-12000 range)
   - Starts the backend server via `cargo run`
   - Passes the port to the frontend via the `get_backend_port` command
4. The frontend connects to the backend on the dynamic port

### Production Build
When you build the desktop app:
1. The frontend is built into static files (`../frontend/dist`)
2. Tauri bundles these files into the native app
3. When the app launches:
   - It finds an available port
   - Starts the backend server as a subprocess
   - Serves the frontend from the bundled files
   - Connects them together

## Port Communication

The key innovation here is dynamic port allocation:

```typescript
// Frontend (backendPort.ts)
import { invoke } from '@tauri-apps/api/core'

async function getBackendPort(): Promise<number> {
  const port = await invoke<number>('get_backend_port')
  return port
}
```

```rust
// Backend (lib.rs)
#[tauri::command]
async fn get_backend_port(state: State<'_, BackendState>) -> Result<u16, String> {
    // Returns the dynamically allocated port
}
```

## Running the Desktop App

### Prerequisites
- Node.js 20+
- Rust 1.75+
- Cargo

### Development Mode
```bash
# From the desktop directory
npm run dev

# OR directly with Tauri CLI
npm run tauri:dev
```

This will:
1. Start the frontend dev server (with HMR)
2. Start the Tauri app
3. Auto-start the backend server

### Build for Production
```bash
# From the desktop directory
npm run build

# OR directly with Tauri CLI
npm run tauri:build
```

The built app will be in `src-tauri/target/release/bundle/`

## Running Modes Comparison

### Web Mode (Independent)
```bash
# Terminal 1: Start backend
cd ../backend
cargo run

# Terminal 2: Start frontend
cd ../frontend
npm run dev
```
- Backend runs on port 3001 (or ACT_SERVER_PORT)
- Frontend runs on port 5173 with proxy
- Good for web-only development

### Desktop Mode
```bash
cd ../desktop
npm run dev
```
- Backend runs on dynamic port (5500-12000)
- Frontend served via Tauri
- Native OS integration
- Backend auto-starts/stops with app

## Environment Variables

### Desktop App (.env.desktop)
```env
VITE_DESKTOP_APP=true
VITE_GITHUB_CLIENT_ID=<your-desktop-oauth-client-id>
```

The backend gets these environment variables automatically:
- `ACT_SERVER_PORT`: Dynamic port
- `ACT_SERVER_HOST`: 127.0.0.1
- `ACT_DATABASE_URL`: sqlite:{data_dir}/act.db
- `ACT_WORKSPACE_ROOT_PATH`: ~/Documents/ai-coding-terminal-workspaces
- `ACT_AUTH_JWT_SECRET`: Random UUID (regenerated each launch)

## Troubleshooting

### Frontend can't connect to backend
- Check that `get_backend_port` command is working (check browser console)
- Verify backend started successfully (check Tauri logs)
- Ensure no firewall is blocking localhost connections

### Backend fails to start
- Verify cargo is installed: `which cargo`
- Check backend compiles: `cd ../backend && cargo build`
- Review Tauri logs for error messages

### Port already in use
- The app automatically finds an available port in the 5500-12000 range
- If all ports are busy, it falls back to 3001
- You can check what's using ports: `lsof -i :5500-12000`

## File Structure

```
desktop/
├── src-tauri/          # Tauri Rust code
│   ├── src/
│   │   ├── lib.rs     # Backend manager + Tauri commands
│   │   └── main.rs    # Entry point
│   ├── Cargo.toml     # Rust dependencies
│   ├── tauri.conf.json # Tauri configuration
│   └── capabilities/  # Permission system
├── scripts/           # Helper scripts
│   ├── dev.sh        # Development mode
│   └── build.sh      # Production build
└── package.json      # NPM scripts
```

## Development Tips

1. **Use desktop dev mode for native features** (file system, notifications, etc.)
2. **Use web mode for faster iteration** (no Tauri rebuild needed)
3. **The backend is shared** - changes work in both modes
4. **Frontend changes need refresh** - Tauri dev mode has HMR via the frontend server

## Next Steps

- [ ] Add auto-update support
- [ ] Configure code signing for distribution
- [ ] Add system tray integration
- [ ] Implement native notifications
- [ ] Add deep linking support
