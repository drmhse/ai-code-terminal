# AI Coding Terminal - Frontend Build System

This directory contains the modern frontend build system for the AI Coding Terminal, built with **Vite + TypeScript + CodeMirror 6**.

## 🎯 Purpose

This replaces the previous CDN-based CodeMirror setup with a robust, self-contained build system that provides:

- **Type Safety**: Full TypeScript support with compile-time error checking
- **Reliable Dependencies**: Local npm packages instead of unreliable CDN imports
- **Bundle Optimization**: Tree shaking, code splitting, and minification
- **Development Experience**: Hot reload, source maps, and IDE integration
- **Production Ready**: Self-contained builds with no external runtime dependencies

## 🏗️ Architecture

### Build Output
The build system generates:
- `main.es.js` - Modern ES modules build (with source maps)  
- `main.umd.js` - Universal module build for older browsers (with source maps)

### Integration
Built assets are automatically available to the Express app via symlink:
```
app/public/dist/ -> ../../frontend/dist/
```

## 📦 Dependencies

### Core Dependencies
- **CodeMirror 6**: Full language support (JavaScript, Python, JSON, CSS, HTML, etc.)
- **Vue 3**: For future component development
- **TypeScript**: Type safety and modern JavaScript features

### Build Tools
- **Vite**: Fast build tool and dev server
- **Terser**: Code minification
- **TypeScript Compiler**: Type checking

## 🚀 Usage

### Development
```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Build for production
npm run build

# Development server (future use)
npm run dev
```

### Quick Build Script
```bash
# Use the convenience script
./build.sh
```

## 📁 File Structure

```
frontend/
├── src/
│   ├── editor.ts          # Main CodeMirror setup (TypeScript)
│   ├── main.ts            # Entry point & global exports
│   ├── types/
│   │   └── editor.ts      # TypeScript interfaces
│   ├── components/        # Future Vue components
│   └── utils/             # Utility functions
├── dist/                  # Build output (gitignored)
├── package.json          # Dependencies & scripts
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
├── build.sh              # Convenience build script
└── README.md             # This file
```

## 🔧 Configuration

### Vite Config (`vite.config.ts`)
- **Library mode**: Generates both ES and UMD builds
- **Self-contained**: All dependencies bundled
- **Source maps**: Enabled for debugging
- **Tree shaking**: Dead code elimination
- **Terser**: Code minification

### TypeScript Config (`tsconfig.json`)
- **Target**: ES2020
- **Strict mode**: Full type safety
- **Module resolution**: Bundler mode for Vite compatibility
- **Path mapping**: `@/*` aliases for clean imports

## 🎨 CodeMirror Features

The editor module (`src/editor.ts`) provides:

### Language Support
- JavaScript/TypeScript (with JSX)
- Python, JSON, CSS, HTML
- Markdown, XML, YAML, SQL
- PHP, Rust, C++, Java, Go
- Shell scripts and config files

### Editor Features  
- Syntax highlighting
- Line numbers & folding
- Bracket matching
- Active line highlighting
- Search & replace
- Command palette
- Undo/redo history
- Tab indentation
- Custom themes (light/dark)

### API
```typescript
import { createUnifiedEditor } from './editor'

const editor = createUnifiedEditor(containerElement, {
  content: 'console.log("Hello World!");',
  fileExtension: 'js',
  theme: 'dark',
  readonly: false,
  onChange: (content) => console.log('Changed:', content)
})
```

## 🔄 Integration with Express App

### Template Integration
The EJS templates load the bundled assets:
```html
<!-- Modern browsers -->
<script type="module" src="/dist/main.es.js"></script>
<!-- Legacy browser fallback -->  
<script nomodule src="/dist/main.umd.js"></script>
```

### Global API
The build exposes `window.CodeMirrorSetup` for the existing Vue.js code:
```javascript
// Same API as before, now with TypeScript reliability
const editor = window.CodeMirrorSetup.createUnifiedEditor(container, options)
```

## 🐳 Docker Integration

The main Dockerfile includes a multi-stage build:

### Stage 1: Frontend Build
```dockerfile
FROM node:20-alpine AS frontend-builder
# Install dependencies and build frontend assets
```

### Stage 2: App Build
```dockerfile  
# Copy built assets from frontend-builder
COPY --from=frontend-builder /frontend/dist ./public/dist
```

## 🛠️ Development Workflow

### Making Changes
1. Edit TypeScript files in `src/`
2. Run `npm run type-check` to verify types
3. Run `npm run build` to create production bundle
4. Test with Express app

### Adding New Languages
1. Install CodeMirror language package: `npm install @codemirror/lang-{language}`
2. Import in `src/editor.ts`
3. Add to `LANGUAGE_MAP` with file extensions
4. Rebuild and test

### Debugging
- Source maps are generated for both builds
- Console logs show detailed language loading information
- TypeScript compiler catches errors at build time

## ✅ Benefits Over Previous CDN Approach

1. **Reliability**: No more "Module not found" CDN failures
2. **Performance**: Bundled dependencies, no network requests
3. **Type Safety**: Compile-time error detection
4. **Bundle Optimization**: Tree shaking reduces file size
5. **Offline Development**: Works without internet
6. **Version Pinning**: Exact dependency versions
7. **Better Debugging**: Source maps and error reporting

## 📈 Next Steps

This foundation enables future improvements:
- Vue 3 component migration
- Advanced CodeMirror extensions
- Custom themes and plugins
- Hot module replacement in development
- Advanced TypeScript features
- Unit testing with Vitest