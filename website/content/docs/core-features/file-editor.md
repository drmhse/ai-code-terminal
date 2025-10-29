---
title: "File Editor"
description: "Integrated code editor with syntax highlighting and theme support"
weight: 25
layout: "docs"
---

# File Editor

The integrated CodeMirror editor provides professional code editing capabilities directly within your terminal environment. Edit files without leaving your workflow, with full syntax highlighting and theme integration.

## Language Support

**Syntax Highlighting**
Native support for popular programming languages:
- **JavaScript/TypeScript:** Full ES6+ and JSX/TSX support
- **Python:** Complete syntax highlighting for modern Python
- **Web Technologies:** HTML, CSS, SCSS, SASS, LESS
- **Data Formats:** JSON, YAML, XML, SQL
- **Systems Programming:** Go, Rust, C/C++, Java
- **Shell Scripts:** Bash, Zsh, Fish
- **Configuration:** TOML, INI, ENV files

**Smart Language Detection**
File extensions automatically trigger appropriate syntax highlighting. Unknown formats fall back to intelligent highlighting patterns.

## Editor Modes

**Read-Only Preview**
Browse code files with full syntax highlighting without risk of accidental modifications. Perfect for code review and exploration.

**Full Edit Mode** 
Complete editing capabilities with:
- Multi-cursor support
- Bracket matching and auto-completion
- Code folding and indentation
- Search and replace functionality
- Keyboard shortcuts and vim-style bindings

## Theme Integration

**Automatic Theme Sync**
Editor themes automatically match your terminal theme selection. Switch themes globally and see changes reflected immediately in both terminal and editor.

**Dynamic Color Support**
Custom themes defined in your theme system are fully supported in the editor with proper syntax highlighting colors.

**Dark/Light Mode**
Seamless switching between light and dark editor themes based on your preference.

## Workflow Integration

**Terminal-First Philosophy**
The editor complements rather than replaces terminal-based workflows. Use it for quick edits while keeping your primary development in the terminal.

**File Tree Integration**
Click files in the explorer to preview them instantly. Double-click to open in full edit mode. Right-click for context actions.

**Persistent Sessions**
Editor state and content are maintained across browser sessions. Return to your work exactly where you left off.

## Getting Started

**Opening Files**
1. Use the file explorer to navigate to your code
2. Click any file to preview with syntax highlighting
3. Click the edit button to switch to full edit mode
4. Save changes with Ctrl+S (Cmd+S on Mac)

**Keyboard Shortcuts**
- **Ctrl/Cmd + S:** Save file
- **Ctrl/Cmd + F:** Find in file
- **Ctrl/Cmd + G:** Go to line
- **Tab:** Indent selection
- **Shift + Tab:** Outdent selection

## Use Cases

**Quick Edits**
Make rapid changes to configuration files, documentation, or small code fixes without launching external editors.

**Code Review**
Browse through code with proper syntax highlighting to understand project structure and review changes.

**Configuration Management**
Edit JSON configurations, environment files, and deployment scripts with validation and formatting.

**Documentation Writing**
Write and edit Markdown documentation with live preview and proper formatting.

## Performance

**Lazy Loading**
Large files are loaded efficiently with syntax highlighting applied progressively. Editor remains responsive even with substantial codebases.

**Memory Efficient**
CodeMirror's virtual scrolling ensures smooth performance regardless of file size.