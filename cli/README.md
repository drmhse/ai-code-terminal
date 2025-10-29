# Act CLI

Act CLI is a context-aware command-line interface that enables persistent context management for AI-assisted development workflows. It provides a structured approach to accumulating and managing contextual information before interacting with AI coding assistants.

## Overview

Act CLI transforms the traditional stateless terminal interaction into a stateful, context-aware development environment. The tool maintains a workspace-specific context buffer that allows developers to systematically collect code files, git diffs, and command outputs before sending structured requests to AI backends.

## Core Concepts

### Context Buffer
A persistent, workspace-specific staging area where users collect information before AI interaction. Each workspace maintains its own isolated context buffer.

### Context Items
Individual pieces of information within the buffer, containing both content and metadata about the source (file path, command executed, timestamp).

### AI Backend Integration
Configurable integration with AI command-line tools through a wrapper that handles context formatting and process management.

## Prerequisites

- Node.js >= 14.0.0
- npm >= 6.0.0
- Git (for git diff functionality)
- Compatible AI CLI tool (claude, gemini, etc.)

## Installation

### Container Environment
Act CLI is pre-installed in the AI Coding Terminal container.

### Standalone Installation
```bash
npm install -g @drmhse/act-cli
act init
```

## Command Reference

### Context Management

#### Add Content to Context
```bash
act context add <files...>          # Add files to context buffer
act context add --diff              # Add staged git diff
act context add --exec "command"    # Add command output
```

#### View Context
```bash
act context list                    # Show context summary
act context show [index]            # Display specific item
```

#### Modify Context
```bash
act context remove <items...>      # Remove by index or pattern
act context clear                   # Clear all context
```

### AI Interaction
```bash
act do "<prompt>"                   # Query AI with context
act do --no-context "<prompt>"     # Query AI without context
```

### Workflow Commands
```bash
act commit                          # Generate commit message from staged changes
act commit -a                       # Stage all changes and generate commit
act review                          # Code review current branch vs main
act review -b <branch>              # Review vs specified branch
act test                            # Generate tests for staged changes
act explain                         # Explain code/output with context
act fix                             # AI-powered error analysis
```

### Configuration
```bash
act config set <key> <value>        # Set configuration value
act config get <key>                # Get configuration value
act config list                     # Show all configuration
act init                            # Initialize act-cli
```

## Architecture

### Storage
- **Configuration**: `~/.act/config.json`
- **Context Buffer**: `~/.act/context/<workspace-hash>/`
- **Workspace Detection**: Git repository root or current directory

### Context Storage Format
Each context item is stored as a JSON file containing:
```json
{
  "metadata": {
    "type": "file|diff|exec",
    "source": "path/to/file",
    "timestamp": "ISO-8601",
    "size": 1024
  },
  "content": "actual content"
}
```

## Configuration

### Backend Configuration
```bash
act config set ai_backend.command "claude"
act config set ai_backend.args '["--print"]'
```

### Custom Prompt Templates
Custom prompts for workflow commands can be configured:
```bash
act config set golden_paths.commit "Your custom commit prompt"
```

## Security Considerations

- Command execution through `--exec` flag includes basic input validation
- File size limits prevent memory exhaustion
- No automatic execution of untrusted commands

## Troubleshooting

### AI Backend Not Found
```bash
# Verify AI CLI installation
which claude
npm install -g @anthropic-ai/claude-code
```

### Git Repository Issues
```bash
# Initialize repository if needed
git init
# Or use non-git alternatives
act context add --exec "ls -la"
```

### Context Buffer Issues
```bash
# Clear corrupted context
act context clear
# Reset configuration
rm ~/.act/config.json
```

### Performance Issues
- Use `act context clear` for large contexts
- File size limit: 5MB per file
- Context items are loaded on demand

## Development

### Testing
```bash
npm test
```

### Project Structure
```
src/
├── context-manager.js    # Context buffer operations
├── config-manager.js     # Configuration management
├── ai-wrapper.js         # AI backend integration
└── index.js              # Main exports

bin/
└── act.js               # CLI entry point

__tests__/
└── *.test.js            # Test suites
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue in the project repository
- Check the troubleshooting section above
- Review existing documentation

## Version Information

Current version information available via:
```bash
act --version
```
