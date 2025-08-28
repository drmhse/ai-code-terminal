# Act CLI Design Specification

## Project Overview

### Mission Statement
Reduce the cognitive overhead of AI-assisted development by transforming the ephemeral nature of shell interactions into persistent, manageable context. Act CLI serves as a tool-agnostic meta-layer that enhances existing AI command-line interfaces.

### Core Principles
1. **Shell-First Integration**: Enhance existing terminal workflows rather than replacing them
2. **Explicit User Control**: Context is built through deliberate user actions
3. **Tool Agnosticity**: Support for multiple AI backends (Claude, GPT, Gemini, Ollama)
4. **Reproducible Interactions**: Context is inspectable, shareable, and persistent

## Architecture Design

### System Components

#### Context Manager
**Responsibility**: Persistent context buffer management
**Location**: `src/context-manager.js`
**Functions**:
- CRUD operations on context items
- File system interaction with `~/.act/context/`
- Workspace identification via Git repository root
- Content validation and size limits

#### Configuration Manager
**Responsibility**: System configuration and golden path prompts
**Location**: `src/config-manager.js`
**Functions**:
- Configuration file management
- AI backend configuration
- Golden path prompt customization
- Shell integration setup

#### AI Wrapper
**Responsibility**: AI backend abstraction and communication
**Location**: `src/ai-wrapper.js`
**Functions**:
- Backend process spawning
- Context formatting and injection
- Input/output stream management
- Error handling and recovery

### Data Architecture

#### Context Storage Structure
```
~/.act/
├── config.json              # Global configuration
└── context/
    └── <workspace-hash>/     # Per-workspace context
        ├── .counter          # ID generation counter
        ├── 1_file.json       # Context items
        ├── 2_diff.json
        └── 3_exec.json
```

#### Context Item Schema
```json
{
  "metadata": {
    "type": "file|diff|exec",
    "source": "path/to/source",
    "timestamp": "ISO-8601-datetime",
    "size": 1024
  },
  "content": "actual content string"
}
```

#### Configuration Schema
```json
{
  "version": 1,
  "ai_backend": {
    "command": "claude",
    "args": ["--print"]
  },
  "prompt_template": {
    "prefix": "### CONTEXT ###\n",
    "item_header": "--- {type}: {source} ---\n",
    "suffix": "\n### END CONTEXT ###\n\n### PROMPT ###\n"
  },
  "golden_paths": {
    "commit": "Generate conventional commit message...",
    "test": "Generate unit tests for changes...",
    "review": "Perform code review of changes..."
  }
}
```

## Command Interface Design

### Context Management Commands
```bash
act context add <files...>         # Add files to context
act context add --diff             # Add git diff output
act context add --exec "command"   # Add command output
act context list                   # List context items
act context show [index]           # Show specific item
act context remove <items...>      # Remove by index or pattern
act context clear                  # Clear all context
```

### AI Interaction Commands
```bash
act do "<prompt>"                  # Send context + prompt to AI
act do --no-context "<prompt>"    # Send prompt without context
```

### Workflow Commands
```bash
act commit                         # Generate commit message
act review                         # Code review against main
act test                           # Generate tests
act explain                        # Explain with auto-context
act fix                            # AI-powered debugging
```

### Configuration Commands
```bash
act config set <key> <value>       # Set configuration
act config get <key>               # Get configuration
act config list                    # List all configuration
act init                           # Initialize shell integration
```

## Technical Requirements

### Performance Specifications
- Context operations: <100ms for files under 1MB
- Memory usage: <100MB baseline, <500MB with context
- File size limit: 5MB per file
- Context item limit: 100 per workspace

### Security Requirements
- Input validation for command injection prevention
- File path validation to prevent directory traversal
- Resource limits to prevent denial of service
- No elevation of privileges required

### Compatibility Requirements
- Node.js >= 14.0.0
- Operating systems: Linux, macOS
- Shell compatibility: bash, zsh
- Git integration for repository detection

## Integration Patterns

### Shell Integration
The `act init` command installs shell integration:

```bash
# Added to ~/.bashrc or ~/.zshrc
act() {
  command act "$@"
}
```

### AI Backend Integration
Configurable backend support through process spawning:

```javascript
// Backend process management
const aiProcess = spawn(backend.command, backend.args, {
  stdio: ['pipe', 'inherit', 'inherit']
});
```

### Git Integration
Repository detection and diff extraction:

```javascript
// Workspace identification
const gitRoot = execSync('git rev-parse --show-toplevel');
const workspaceHash = crypto.createHash('md5').update(gitRoot).digest('hex');
```

## Error Handling Strategy

### Input Validation
- File existence and readability checks
- Command string sanitization
- Configuration format validation
- User input length limits

### Runtime Error Recovery
- Graceful backend process failure handling
- Context corruption detection and recovery
- Network timeout management
- Resource exhaustion prevention

### User Error Communication
- Clear, actionable error messages
- Diagnostic information inclusion
- Recovery suggestions
- Debug mode availability

## Testing Strategy

### Unit Testing
- Context manager operations
- Configuration loading and validation
- Command parsing and validation
- Error condition handling

### Integration Testing
- End-to-end workflow validation
- AI backend communication
- Git repository integration
- File system operations

### Security Testing
- Command injection attempts
- File system traversal attempts
- Resource exhaustion scenarios
- Configuration tampering

## Deployment Considerations

### Package Distribution
- npm registry publication
- Semantic versioning adherence
- Dependency management
- Cross-platform compatibility

### Installation Process
- Global npm package installation
- Shell integration setup
- Configuration initialization
- Permission requirements

### Update Management
- Backward compatibility maintenance
- Configuration migration
- Deprecation notices
- Rollback procedures

## Monitoring and Maintenance

### Error Reporting
- Unhandled exception capturing
- Performance metric collection
- User feedback integration
- Issue tracking correlation

### Performance Monitoring
- Operation timing measurement
- Memory usage tracking
- File system usage monitoring
- Network request latency

### Maintenance Procedures
- Dependency security updates
- Performance optimization
- Bug fix deployment
- Feature enhancement delivery

## Future Extensibility

### Plugin Architecture Considerations
- Command extension mechanism
- Custom backend integration
- Golden path customization
- Context transformer plugins

### API Evolution
- Backward compatibility guarantees
- Deprecation lifecycle management
- Feature flag implementation
- Configuration schema versioning

### Community Integration
- Contribution guidelines establishment
- Code review process definition
- Documentation maintenance
- Issue triage procedures

## Risk Management

### Technical Risks
- AI backend API changes
- Operating system compatibility issues
- Performance degradation with large contexts
- Security vulnerability discovery

### Operational Risks
- User data loss scenarios
- Service interruption handling
- Support request volume management
- Community management challenges

### Mitigation Strategies
- Comprehensive testing coverage
- Defensive programming practices
- User education and documentation
- Community engagement and support