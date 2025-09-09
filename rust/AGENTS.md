# Agent Guidelines for AI Coding Terminal

## Build & Test Commands

### Rust Backend
```bash
# Build all crates
cargo build

# Run tests
cargo test

# Run specific test
cargo test test_name

# Lint with clippy
cargo clippy

# Format code
cargo fmt
```

### Vue Frontend
```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Run specific test file
npm run test -- path/to/test.spec.ts
```

## Code Style Guidelines

### Rust
- Use workspace dependencies defined in backend/Cargo.toml
- Follow standard Rust naming conventions (snake_case for functions, PascalCase for types)
- Use thiserror for custom error types
- Prefer async/await with tokio runtime
- Use tracing for structured logging
- Database operations must use sqlx with proper error handling

### Vue/TypeScript
- Use Composition API with `<script setup>`
- TypeScript strict mode enabled
- Import order: standard library, third-party, local modules
- Use Pinia for state management
- Component naming: PascalCase for files, kebab-case for templates
- Use @ alias for src imports (e.g., '@/components/...')
- ESLint with Vue/TypeScript rules enforced

### General
- No emojis in code - use SVG icons only
- Database changes require migration files
- Follow existing file structure and patterns
- Use existing utility functions and libraries
- Error messages should be descriptive and user-friendly