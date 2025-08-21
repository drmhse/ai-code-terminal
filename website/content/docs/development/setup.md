---
title: "Development Setup"
description: "Complete development environment setup for AI Code Terminal"
weight: 10
layout: "docs"
---

# Development Setup

This guide covers setting up a complete development environment for AI Code Terminal, including all dependencies, tools, and configurations needed for local development.

## Prerequisites

### System Requirements

- **Node.js:** 18.x or higher (LTS recommended)
- **npm:** 9.x or higher (comes with Node.js)
- **Git:** Latest stable version
- **Docker:** Latest stable version (optional, for containerized testing)
- **GitHub Account:** For OAuth testing

### Recommended Tools

- **VS Code:** With recommended extensions
- **GitHub CLI:** For repository management
- **Postman:** For API testing
- **Docker Desktop:** For container development

## Repository Setup

### Clone Repository

```bash
# Clone the main repository
git clone https://github.com/your-username/ai-coding-terminal.git
cd ai-coding-terminal

# Install dependencies
npm install
```

### Environment Configuration

```bash
# Copy example environment file
cp env.example .env

# Edit the environment file with your settings
nano .env  # or your preferred editor
```

### Required Environment Variables

```bash
# Development Environment Configuration
NODE_ENV=development
PORT=3014
HOST=localhost

# JWT Configuration (generate a secure secret)
JWT_SECRET=your-development-jwt-secret-at-least-32-characters-long

# GitHub OAuth (create a GitHub OAuth app)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3014/auth/github/callback

# Single-tenant user (your GitHub username)
TENANT_GITHUB_USERNAME=your-github-username

# Database
DATABASE_URL=file:./data/database.db

# Optional Development Settings
DEBUG=ai-code-terminal:*
LOG_LEVEL=debug
WORKSPACE_ROOT=./workspaces
MAX_WORKSPACES_PER_USER=10
```

### GitHub OAuth App Setup

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/applications/new)
2. Create a new OAuth App with these settings:
   - **Application name:** AI Code Terminal (Development)
   - **Homepage URL:** http://localhost:3014
   - **Authorization callback URL:** http://localhost:3014/auth/github/callback
3. Copy the Client ID and Client Secret to your `.env` file

## Database Setup

### Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# Optional: Seed with test data
npm run seed
```

### Database Management

```bash
# View database in Prisma Studio
npx prisma studio

# Reset database (development only)
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name add_new_field
```

## Development Scripts

### Available Scripts

```bash
# Start development server with auto-restart
npm run dev

# Start production server
npm start

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Development Server

```bash
# Start with default settings
npm run dev

# Start with debug logging
DEBUG=* npm run dev

# Start on different port
PORT=3015 npm run dev
```

The development server includes:
- **Auto-restart:** Automatically restarts on file changes
- **Hot reload:** Frontend updates without full reload
- **Debug logging:** Comprehensive logging in development
- **Source maps:** For easier debugging

## Project Structure

### Directory Overview

```
ai-coding-terminal/
├── src/                    # Source code
│   ├── app.js             # Express application setup
│   ├── controllers/       # API endpoint controllers
│   ├── middleware/        # Express middleware
│   ├── services/          # Business logic services
│   ├── socket/            # Socket.IO event handlers
│   ├── utils/             # Utility functions
│   └── config/            # Configuration files
├── views/                 # EJS templates
│   ├── layout.ejs         # Main layout
│   └── partials/          # Template partials
├── public/                # Static assets
├── prisma/                # Database schema and migrations
├── workspaces/            # User workspaces (created at runtime)
├── data/                  # SQLite database
├── __tests__/             # Test files
├── docs/                  # Documentation
└── scripts/               # Build and deployment scripts
```

### Source Code Organization

```
src/
├── app.js                 # Main Express app
├── server.js              # Server entry point
├── controllers/           # Request handlers
│   ├── auth.controller.js
│   ├── workspace.controller.js
│   └── github.controller.js
├── services/              # Business logic
│   ├── github.service.js
│   ├── workspace.service.js
│   ├── shell.service.js
│   └── settings.service.js
├── middleware/            # Express middleware
│   ├── auth.middleware.js
│   ├── validation.middleware.js
│   └── security.middleware.js
├── socket/                # Real-time communication
│   └── socket.handler.js
├── utils/                 # Helper functions
│   ├── encryption.js
│   ├── validation.js
│   └── logger.js
└── config/                # Configuration
    ├── database.js
    ├── cors.js
    └── constants.js
```

## IDE Configuration

### VS Code Setup

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.ejs": "html"
  },
  "emmet.includeLanguages": {
    "ejs": "html"
  },
  "sqltools.connections": [
    {
      "name": "AI Code Terminal DB",
      "driver": "SQLite",
      "database": "./data/database.db"
    }
  ]
}
```

### Recommended VS Code Extensions

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-node-azure-pack"
  ]
}
```

### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Start Development Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server.js",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "ai-code-terminal:*"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeArgs": ["--inspect"]
    },
    {
      "name": "Run Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "test"
      }
    },
    {
      "name": "Attach to Process",
      "type": "node",
      "request": "attach",
      "port": 9229
    }
  ]
}
```

## Code Quality Tools

### ESLint Configuration

`.eslintrc.js`:

```javascript
module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error'
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.js', '**/*.test.js'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off'
      }
    }
  ]
};
```

### Prettier Configuration

`.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### Git Hooks with Husky

```bash
# Install husky
npm install --save-dev husky lint-staged

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

`package.json` configuration:

```json
{
  "lint-staged": {
    "*.js": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write",
      "git add"
    ]
  }
}
```

## Development Workflow

### Feature Development

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/new-terminal-features
   ```

2. **Make Changes**
   - Write code following established patterns
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Changes**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new terminal features"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/new-terminal-features
   # Create pull request on GitHub
   ```

### Local Testing

#### Manual Testing

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Access Application**
   - Open http://localhost:3014
   - Login with GitHub
   - Test terminal functionality
   - Test workspace management

3. **API Testing with curl**
   ```bash
   # Test health endpoint
   curl http://localhost:3014/health
   
   # Test authenticated endpoint (after login)
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        http://localhost:3014/api/workspaces
   ```

#### Automated Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=workspace

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Environment Management

### Multiple Environments

Create different environment files:

```bash
# Development
.env.development

# Testing
.env.test

# Local production testing
.env.local
```

### Environment Loading

```javascript
// src/config/environment.js
const dotenv = require('dotenv');
const path = require('path');

const loadEnvironment = () => {
  const env = process.env.NODE_ENV || 'development';
  const envPath = path.resolve(process.cwd(), `.env.${env}`);
  
  // Load environment-specific file if it exists
  if (require('fs').existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    // Fallback to .env
    dotenv.config();
  }
  
  // Validate required environment variables
  validateEnvironment();
};

const validateEnvironment = () => {
  const required = [
    'JWT_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'TENANT_GITHUB_USERNAME'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate JWT secret length
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
};

module.exports = { loadEnvironment };
```

## Debugging

### Debug Configuration

```javascript
// Enable debug logging
const debug = require('debug');

// Create debug namespaces
const debugAuth = debug('ai-code-terminal:auth');
const debugWorkspace = debug('ai-code-terminal:workspace');
const debugTerminal = debug('ai-code-terminal:terminal');

// Usage
debugAuth('User authenticated: %s', username);
debugWorkspace('Creating workspace: %s', workspaceName);
debugTerminal('Terminal session started: %s', sessionId);
```

### Running with Debug

```bash
# Enable all debug output
DEBUG=* npm run dev

# Enable specific modules
DEBUG=ai-code-terminal:* npm run dev

# Enable only auth debugging
DEBUG=ai-code-terminal:auth npm run dev
```

### Chrome DevTools

```bash
# Start with inspector
node --inspect server.js

# Start with inspector and break on first line
node --inspect-brk server.js
```

Then open Chrome and navigate to `chrome://inspect`

## Performance Monitoring

### Development Metrics

```javascript
// src/utils/metrics.js
const performanceMetrics = {
  trackApiCall: (endpoint, duration) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Call: ${endpoint} took ${duration}ms`);
    }
  },
  
  trackDatabaseQuery: (query, duration) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`DB Query: ${query} took ${duration}ms`);
    }
  },
  
  trackMemoryUsage: () => {
    const usage = process.memoryUsage();
    console.log('Memory Usage:', {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`
    });
  }
};
```

### Profiling

```bash
# Profile CPU usage
node --prof server.js

# Generate profile report
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > profile.txt

# Profile memory
node --inspect --max-old-space-size=4096 server.js
```

## Common Development Tasks

### Database Operations

```bash
# Reset and reseed database
npm run db:reset

# View database contents
npx prisma studio

# Generate new migration
npx prisma migrate dev --name descriptive_name

# Apply pending migrations
npx prisma migrate deploy
```

### Code Generation

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Generate API documentation
npm run docs:generate

# Generate TypeScript types
npm run types:generate
```

### Testing Specific Features

```bash
# Test authentication flow
npm run test:auth

# Test workspace management
npm run test:workspace

# Test terminal functionality
npm run test:terminal

# Test WebSocket communication
npm run test:socket
```

## Troubleshooting Development Issues

### Common Problems

**Port Already in Use**
```bash
# Kill process using port 3014
lsof -ti:3014 | xargs kill -9

# Use different port
PORT=3015 npm run dev
```

**Database Connection Issues**
```bash
# Reset database
npx prisma migrate reset

# Recreate database file
rm data/database.db
npx prisma db push
```

**Node Module Issues**
```bash
# Clear npm cache
npm cache clean --force

# Remove and reinstall modules
rm -rf node_modules package-lock.json
npm install
```

**Environment Variable Issues**
```bash
# Verify environment variables are loaded
node -e "console.log(process.env.JWT_SECRET ? 'JWT_SECRET loaded' : 'JWT_SECRET missing')"
```

### Debugging Tips

1. **Use Console Debugging Strategically**
   ```javascript
   console.log('DEBUG: Variable value:', { variable });
   console.trace('DEBUG: Function call stack');
   ```

2. **Inspect WebSocket Messages**
   ```javascript
   // Client-side debugging
   socket.onAny((event, ...args) => {
     console.log('Socket event:', event, args);
   });
   ```

3. **Monitor File Changes**
   ```bash
   # Watch for file changes
   npx nodemon --watch src --exec "npm test"
   ```

4. **Database Query Debugging**
   ```javascript
   // Enable Prisma query logging
   const prisma = new PrismaClient({
     log: ['query', 'info', 'warn', 'error'],
   });
   ```

## Next Steps

- **[Testing](/docs/development/testing/):** Comprehensive testing strategies
- **[Production Setup](/docs/deployment/production/):** Production deployment
- **[Troubleshooting](/docs/troubleshooting/common-issues/):** Common issues and solutions