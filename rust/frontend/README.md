# AI Terminal Frontend

A sophisticated terminal interface with AI capabilities, built with Vue 3, TypeScript, and Vite.

## Features

- **AI-Powered Terminal**: Smart command completion and natural language processing
- **Multi-Workspace Support**: Manage multiple projects and repositories
- **Real-time Collaboration**: WebSocket-based terminal sessions
- **Background Process Management**: Monitor and control system processes
- **File System Integration**: Full file browser with CRUD operations
- **Task Management**: Integration with Microsoft To Do
- **Dark/Light Themes**: Customizable interface themes
- **Responsive Design**: Works on desktop, tablet, and mobile

## Development Modes

This project supports two development modes:

### Standard Mode (with Backend)
Requires the backend server to be running.

```sh
npm install
npm run dev
```

### Mock Mode (Backend-less)
For development, testing, and demonstrations without requiring a backend server.

```sh
npm install
npm run dev:mock
```

The mock mode provides a fully functional experience with:
- Simulated API responses with realistic delays
- Mock file system with sample project structure
- Interactive terminal with command interpreter
- Real-time system stats simulation
- Sample workspaces and repositories
- Mock authentication flow

## Available Scripts

```sh
# Development
npm run dev              # Standard development mode (requires backend)
npm run dev:mock         # Mock development mode (backend-less)

# Building
npm run build            # Production build (requires backend)
npm run build:mock       # Mock production build (backend-less)

# Preview
npm run preview          # Preview production build
npm run preview:mock     # Preview mock production build

# Utilities
npm run type-check       # TypeScript type checking
npm run lint             # ESLint code linting
```

## Mock Mode Details

### What's Mocked?
- **Authentication**: Simulated SSO flow with mock user profiles
- **API Endpoints**: All REST API calls with realistic data and delays
- **WebSocket Events**: Real-time terminal output and system stats
- **File System**: Complete mock file system with sample projects
- **Repositories**: Mock GitHub repositories with pagination and search
- **Tasks**: Microsoft To Do integration with sample tasks and lists
- **Processes**: Background process management with simulated stats

### Sample Data Structure
The mock mode includes realistic sample data:
- 4 sample workspaces (AI Terminal, Documentation, CLI Tools, Vue Components)
- 127 mock repositories with various languages and metadata
- Complete file system for AI Terminal project with actual file contents
- Interactive terminal supporting commands like `ls`, `cat`, `cd`, `git`, etc.
- 14 sample tasks across 4 different task lists
- 5 background processes with status monitoring

## Netlify Deployment

This project is configured for easy deployment to Netlify in mock mode, allowing you to showcase the application without a backend server.

### Automatic Configuration

The repository includes `netlify.toml` which automatically:
- Builds the mock version (`npm run build:mock`)
- Uses `.env.mock` for configuration (no sensitive data)
- Configures proper redirects for SPA routing
- Sets security headers (X-Frame-Options, CSP, etc.)
- Enables caching for static assets

### Deploy to Netlify

#### Option 1: Connect Your Repository
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Netlify](https://netlify.com) and click "Add new site"
3. Connect your repository
4. Netlify will automatically detect `netlify.toml` and configure the build
5. Click "Deploy" - that's it!

#### Option 2: Deploy with Netlify CLI
```sh
# Install Netlify CLI
npm install -g netlify-cli

# Build and deploy
npm run build:mock
netlify deploy --prod --dir=dist
```

### Security Notes

- `.env.mock` contains only non-sensitive mock configuration
- Real `.env` files are excluded via `.gitignore`
- All API URLs in mock mode point to fake endpoints
- No real authentication credentials are used
- Mock mode is completely safe for public deployment

### What Works in the Deployed Version?

All features work in mock mode:
- Full authentication flow (simulated)
- Terminal with command execution
- File browser and editor
- Workspace management
- Background processes
- Task management
- All UI components and themes

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

### Recommended Extensions
- TypeScript Vue Plugin (Volar)
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- GitLens

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Structure

```
src/
├── components/          # Vue components
├── services/           # API and socket services
│   ├── api.ts          # Service switcher
│   ├── realApiService.ts    # Real API implementation
│   ├── mockApiService.ts    # Mock API implementation
│   ├── socket.ts       # Socket service switcher
│   ├── realSocketService.ts # Real socket implementation
│   └── mockSocketService.ts # Mock socket implementation
├── stores/             # Pinia state management
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── mockData/           # Mock data for development
│   ├── workspaces.ts   # Mock workspace data
│   ├── repositories.ts # Mock repository data
│   ├── fileSystem.ts   # Mock file system
│   ├── fileSystemUtils.ts # File system utilities
│   ├── processes.ts    # Mock background processes
│   └── tasks.ts        # Mock task management data
└── views/              # Vue page components
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Architecture

The application uses a service-oriented architecture with conditional mock/real implementations based on the `VITE_USE_MOCKS` environment variable. This allows for seamless development without requiring a backend while maintaining production readiness.

### Key Architectural Patterns
- **Service Switcher Pattern**: Conditional export of mock vs real services
- **Mock Data Isolation**: All mock data centralized in `src/mockData/`
- **Realistic Simulation**: Mock services simulate network delays and real-world behavior
- **Type Safety**: Full TypeScript support across mock and real implementations

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
