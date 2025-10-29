---
title: "Terminal Multiplexing"
description: "Use multiple terminals with tabs and split panes for maximum productivity"
weight: 10
layout: "docs"
---

# Terminal Multiplexing

Work with multiple terminals at once using tabs and split-pane layouts. Run your development server in one pane, your tests in another, and Git commands in a third—all in the same window.

## Features

**Multiple Terminal Tabs**
Create as many terminal sessions as you need. Each tab runs its own independent shell process, so you can organize different tasks across different tabs.

**Split-Pane Layouts**
Transform your single terminal into multiple panes arranged side-by-side:
- **Horizontal Split:** Top and bottom panes
- **Vertical Split:** Left and right panes
- **Grid Layout:** Four panes in a 2x2 arrangement

**Session Recovery**
Your terminal sessions keep running even when you close your browser. Come back later and pick up exactly where you left off—with full command history intact.

**Real-time Sync**
Open the same workspace in multiple browser tabs. All terminals stay perfectly synchronized across every window.

## Why This Matters

**No More Context Switching**
Stop jumping between terminal windows. See your development server logs while running tests while committing code—all at the same time.

**Never Lose Your Work**
Started a long-running build process? Close your laptop, go to lunch, and return to find everything still running. Your terminal sessions survive browser crashes, computer restarts, and network disconnections.

**Perfect for Development Workflows**
- **Pane 1:** Run `npm run dev` for your development server
- **Pane 2:** Run `npm test --watch` for continuous testing
- **Pane 3:** Use for Git commands and file operations
- **Pane 4:** Run `claude chat` for AI assistance

## Mobile Compatibility

**Full multiplexing on touchscreens.** All terminal multiplexing features work seamlessly on mobile devices with the advanced mobile input overlay providing professional control over multiple terminals.

**Touch-Optimized Navigation:**
- **Swipe between tabs:** Navigate terminal sessions with intuitive touch gestures
- **Tap to focus panes:** Switch between split terminals with simple taps
- **Layout controls:** Access split-pane options through touch-friendly buttons
- **Persistent sessions:** Long-running processes continue even when switching mobile apps

## Getting Started

1. **Create Additional Tabs:** Click the "+" button to add more terminal sessions
2. **Switch Layouts:** Use the layout buttons to convert between single-pane and multi-pane views
3. **Focus Panes:** Click any pane to switch focus and start typing
4. **Recover Sessions:** If you disconnect, just refresh your browser—everything will be restored

> **Pro Tip:** Your terminals are automatically saved and will persist across browser sessions. Start a process today, come back tomorrow, and it's still running!

## Quick Example

Here's how a typical development workflow looks:

```bash
# Pane 1: Start your dev server
npm run dev
# Server starts on http://localhost:3000

# Pane 2: Run tests in watch mode  
npm test --watch
# Tests run automatically on file changes

# Pane 3: Work with Git
git status
git add src/components/NewFeature.js
git commit -m "Add new feature component"

# Pane 4: Get AI help
claude chat "How can I optimize this React component?"
# Get instant coding assistance
```

All of this happens simultaneously in one browser window!

## Pro Tips

**Organize by Task Type**
- Tab 1: "Dev Server" - Keep your development server running
- Tab 2: "Testing" - Run tests and debugging commands
- Tab 3: "Git" - All your version control operations
- Tab 4: "Claude" - AI assistance and code questions

**Use the Grid Layout for Maximum Efficiency**
The 2x2 grid layout lets you monitor four different processes simultaneously—perfect for complex development workflows.

**Take Advantage of Persistence**
Start long-running processes knowing they'll survive browser refreshes and disconnections. This is especially useful for:
- Development servers (`npm run dev`, `yarn start`)
- Test watchers (`jest --watch`, `npm test`)
- Build processes (`npm run build`)
- Database connections