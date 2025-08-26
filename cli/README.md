# Act CLI - AI-Aware Context Management

A revolutionary CLI tool that transforms your terminal into an AI-aware development environment by providing persistent context management for AI interactions.

## 🎯 Vision

Bridge the gap between traditional terminal workflows and AI assistants by making the command line stateful and context-aware.

## 🚀 Quick Start

```bash
# Add files to AI context
act context add src/index.js package.json

# Add git diff to context
act context add --diff

# Add command output to context  
act context add --exec "npm test"

# List current context
act context list

# Clear context
act context clear

# Send context + prompt to AI
act do "Review this code for bugs"

# Golden path commands
act commit    # Generate commit message from staged changes
act review    # Review current branch vs main
act test      # Generate tests for staged changes
```

## 📋 Commands

### Context Management
- `act context add <files...>` - Add files to context buffer
- `act context add --diff` - Add staged git diff
- `act context add --exec "cmd"` - Add command output  
- `act context list` - Show context contents
- `act context show [index]` - Display specific context item
- `act context remove <indices...>` - Remove context items
- `act context clear` - Clear all context

### AI Interaction
- `act do "<prompt>"` - Query AI with context
- `act do --no-context "<prompt>"` - Query AI without context

### Golden Path Workflows
- `act commit` - AI-generated commit messages from staged changes
- `act commit -a` - Stage all changes and generate commit message  
- `act review` - Code review of current branch vs main
- `act review -b develop` - Review vs different base branch
- `act test` - Generate tests for staged changes
- `act test -a` - Stage all + generate tests
- `act explain` - Explain code/output with auto-context
- `act fix` - AI-powered error analysis and fixes

### Workflow Shortcuts
- `act quick-commit` (`qc`) - Stage all + generate commit in one step
- `act debug "command"` - Run failing command + get AI debugging help
- `command | act pipe` - Pipe any output directly to context
- `act workflow` - Show workflow examples and patterns

### Configuration
- `act config set <key> <value>` - Set configuration
- `act config get <key>` - Get configuration  
- `act config list` - Show all config
- `act init` - Initialize act-cli

## 🏗️ How It Works

Act CLI maintains a **Context Buffer** - a workspace-specific staging area where you collect code, diffs, and command outputs before sending to AI. This transforms your terminal from stateless command execution into a stateful, AI-aware environment.

**Context Storage**: `~/.act/context/<workspace-hash>/`
**Configuration**: `~/.act/config.json`

## 🔧 Installation

Inside the AI Code Terminal, act-cli is pre-installed and ready to use.

For standalone installation:
```bash
npm install -g act-cli
act init
```

## 💡 Philosophy

1. **Shell-First**: Enhances terminal workflows, doesn't replace them
2. **Explicit Control**: User deliberately builds context through clear actions
3. **Tool-Agnostic**: Works with any AI CLI (Claude, GPT, Gemini, etc.)
4. **Reproducible**: Context is inspectable and shareable

## 🎯 Game-Changing Impact

Act CLI solves the "context problem" - the missing link between powerful AI coding assistants and the terminal-based development workflow. It transforms every shell session into an AI-aware workspace where context accumulates naturally as you work.

**Before**: Stateless terminal → Copy/paste code → AI interaction  
**After**: Stateful terminal → Automatic context → Seamless AI workflow