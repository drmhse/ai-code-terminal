---
title: "ACT CLI"
description: "Context-aware AI development with the ACT command-line interface"
weight: 60
layout: "docs"
---

# ACT CLI

AI Code Terminal includes the ACT CLI (AI Context Terminal), a powerful command-line tool that transforms your development workflow with context-aware AI interactions. ACT is pre-installed in every workspace, ready to use without any setup.

## How It Works

**Context Buffer System**
ACT maintains a persistent context buffer that lets you accumulate information before sending it to AI backends. This eliminates the need to repeatedly explain your project setup or paste code snippets.

**Pre-Installed and Ready**
The ACT CLI comes pre-installed in the Docker image, so you can start using it immediately:

```bash
act --help
```

**Workspace-Aware**
Each workspace maintains its own isolated context buffer, automatically detecting your Git repository and preserving context across browser sessions.

## Core Workflow

**1. Build Context**
Add relevant information to your context buffer:

```bash
# Add specific files
act context add src/components/UserAuth.js src/utils/api.js

# Add staged changes
act context add --diff

# Add command output
act context add --exec "npm test"
```

**2. Review Context**
See what will be sent to the AI:

```bash
# List all context items
act context list

# Preview specific content
act context show 1

# See total size and summary
act context
```

**3. Query AI**
Send your context and question to Claude or other AI backends:

```bash
# Ask with context
act do "How can I optimize this authentication flow?"

# Preview what gets sent (dry run)
act do --dry-run "Review this code for security issues"

# Query without context
act do --no-context "What's the best way to handle API errors?"
```

## Golden Path Commands

ACT includes pre-configured workflows for common development tasks:

**Commit Message Generation**
```bash
# Stage your changes, then generate commit message
git add .
act commit
```

**Code Review**
```bash
# Review current branch changes vs main
act review
```

**Test Generation**
```bash
# Generate tests for staged changes
git add src/new-feature.js
act test
```

**Code Explanation**
```bash
# Explain code or command output with context
act explain
```

**Error Debugging**
```bash
# Run failing command and get AI help
act debug "npm run build"

# Or add error output and get analysis
act fix
```

**Quick Workflows**
```bash
# Stage all changes and generate commit
act quick-commit

# See workflow examples
act workflow
```

## Context Management

**Adding Content**
```bash
# Multiple files at once
act context add src/**/*.js config/*.json

# Git operations
act context add --diff              # Staged changes
act context add --diff main         # Changes vs main branch

# Command output with validation
act context add --exec "eslint src/"
act context add --exec "git log --oneline -10"
```

**Managing Context**
```bash
# Remove specific items
act context remove 1 3 5

# Remove by pattern
act context remove "*.test.js"

# Clear everything
act context clear

# Import from stdin
echo "Error: Cannot find module" | act pipe
```

**Context Inspection**
```bash
# Summary view
act context list

# Detailed content
act context show 2

# Full context preview
act context show
```

## Configuration

ACT uses workspace-specific configuration stored in `~/.act/`:

**Backend Configuration**
```bash
# Set AI backend (pre-configured for claude)
act config set ai_backend.command "claude"
act config set ai_backend.args '["--print"]'

# View all configuration
act config list
```

**Custom Prompts**
```bash
# Set custom golden path prompts
act config set prompts.commit "Generate a conventional commit message..."
act config set prompts.review "Perform a thorough code review..."
```

**Shell Integration**
```bash
# Initialize shell integration
act init
```

## Advanced Features

**Security and Validation**
- File size limits (5MB per file) prevent memory exhaustion
- Command validation rejects potentially dangerous operations
- Workspace isolation ensures context stays project-specific
- Automatic cleanup of corrupted context files

**Context Intelligence**
- Duplicate detection prevents redundant context items
- Automatic file type detection and appropriate handling
- Git integration for branch-aware context
- Persistent storage across browser sessions

**Error Handling**
- Comprehensive error messages with actionable suggestions
- Automatic recovery from corrupted context files
- Safe command execution with input validation
- Backend availability checking

## Integration with Claude Code

**Seamless Backend**
ACT is pre-configured to work with Claude Code, which is also pre-installed in every workspace. No additional setup required.

**Consistent Authentication**
Use Claude Code's standard authentication flow. Your API key management remains completely under your control through the Claude Code CLI.

**Combined Workflow**
```bash
# Build context with ACT
act context add src/auth.js --diff

# Use Claude Code directly
act do "Review this authentication implementation"

# Or use Claude Code independently
claude chat "How do I handle JWT tokens securely?"
```

## Why ACT Transforms Development

**Context Persistence**
Stop re-explaining your project setup. Build context once and reuse it across multiple AI interactions.

**Workflow Integration**
ACT fits naturally into existing Git workflows, making AI assistance feel like a native part of development.

**Intelligent Defaults**
Golden path commands handle common tasks with battle-tested prompts, so you get consistent, high-quality AI responses.

**Zero Configuration**
Pre-installed and pre-configured in every workspace. Start using AI assistance immediately without any setup overhead.

**Workspace Isolation**
Each project maintains its own context buffer, preventing cross-contamination between different codebases.

## Getting Started

1. **Open any workspace** - ACT is already installed and ready
2. **Add some context** - `act context add src/main.js`
3. **Ask for help** - `act do "Explain how this code works"`
4. **Use golden paths** - Stage changes and run `act commit`
5. **Explore workflows** - `act workflow` shows common usage patterns

ACT transforms your terminal from a stateless command interface into a context-aware AI development environment, making every interaction more intelligent and productive.