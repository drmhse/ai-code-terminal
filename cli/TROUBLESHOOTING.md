# Troubleshooting Guide

This document provides solutions for common issues encountered when using Act CLI.

## Installation Issues

### Command Not Found
**Problem**: `act: command not found` after installation

**Solution**:
```bash
# Verify npm global installation
npm list -g @drmhse/act-cli

# Verify PATH includes npm global binaries
echo $PATH | grep npm

# Reinstall if necessary
npm uninstall -g @drmhse/act-cli
npm install -g @drmhse/act-cli

# Initialize shell integration
act init
source ~/.bashrc  # or ~/.zshrc
```

### Permission Errors
**Problem**: Permission denied during installation

**Solution**:
```bash
# Use npm prefix to avoid permission issues
npm config set prefix ~/.local
echo 'export PATH=~/.local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then reinstall
npm install -g @drmhse/act-cli
```

## AI Backend Configuration

### AI Backend Not Found
**Problem**: `AI backend 'claude' not found`

**Diagnosis**:
```bash
# Check if AI CLI is installed
which claude
which gemini
which openai

# Check current configuration
act config get ai_backend
```

**Solution**:
```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude-code

# Or configure different backend
act config set ai_backend.command "gemini"
act config set ai_backend.args '["chat"]'

# Verify configuration
act config list
```

### Backend Process Errors
**Problem**: AI backend exits with non-zero code

**Diagnosis**:
```bash
# Test backend directly
claude --version
gemini --help

# Check backend configuration
act config get ai_backend
```

**Solution**:
```bash
# Update backend arguments
act config set ai_backend.args '["--no-user-config"]'

# Or reset to default configuration
rm ~/.act/config.json
```

## Context Management Issues

### Context Buffer Corruption
**Problem**: Context commands fail or produce unexpected results

**Diagnosis**:
```bash
# Check context directory
ls -la ~/.act/context/

# Check workspace hash
act context list
```

**Solution**:
```bash
# Clear current context
act context clear

# Reset entire context directory
rm -rf ~/.act/context/

# Recreate context (automatic on next use)
act context add --exec "echo test"
```

### File Size Errors
**Problem**: `File too large` error when adding files

**Solution**:
```bash
# Check file size
ls -lh <filename>

# For large files, use excerpts instead
head -n 100 <filename> > excerpt.txt
act context add excerpt.txt

# Or increase limit (not recommended)
# Files over 5MB can cause memory issues
```

### Git Repository Issues
**Problem**: `Not in a git repository` errors

**Diagnosis**:
```bash
# Check git status
git status
git rev-parse --show-toplevel
```

**Solution**:
```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit"

# Or use non-git alternatives
act context add --exec "find . -name '*.js' | head -10"
act context add --exec "ls -la"
```

## Workspace Detection Issues

### Wrong Workspace Context
**Problem**: Context appears to be shared between different projects

**Diagnosis**:
```bash
# Check current workspace
pwd
git rev-parse --show-toplevel 2>/dev/null || echo "Not in git repo"

# Check context location
act context list
```

**Solution**:
```bash
# Navigate to correct project root
cd /path/to/project

# Clear context if needed
act context clear

# Verify workspace isolation
act context add --exec "pwd"
```

## Command Execution Issues

### Unsafe Command Errors
**Problem**: `Command contains unsafe characters` when using `--exec`

**Solution**:
```bash
# Use simple commands only
act context add --exec "ls -la"
act context add --exec "cat package.json"

# Avoid shell operators
# Bad: act context add --exec "ls | grep .js"
# Good: act context add --exec "find . -name '*.js'"

# For complex commands, create a script
echo '#!/bin/bash\nls | grep .js' > list_js.sh
chmod +x list_js.sh
act context add --exec "./list_js.sh"
```

### Command Output Issues
**Problem**: Command produces no output or empty context

**Diagnosis**:
```bash
# Test command directly
your-command

# Check for stderr
your-command 2>&1
```

**Solution**:
```bash
# Ensure command produces stdout
act context add --exec "echo 'test output'"

# For commands that only produce stderr
act context add --exec "your-command 2>&1"
```

## Configuration Issues

### Configuration Not Loading
**Problem**: Custom configurations are ignored

**Diagnosis**:
```bash
# Check config file exists and is valid
cat ~/.act/config.json
```

**Solution**:
```bash
# Validate JSON format
python -m json.tool ~/.act/config.json

# Reset configuration if corrupted
rm ~/.act/config.json

# Set configuration values again
act config set ai_backend.command "your-backend"
```

### Shell Integration Issues
**Problem**: `act init` doesn't work or shell integration fails

**Diagnosis**:
```bash
# Check shell type
echo $SHELL

# Check profile files
ls -la ~/.bashrc ~/.zshrc ~/.bash_profile
```

**Solution**:
```bash
# Manual shell integration
echo 'export PATH=~/.act/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Or for zsh
echo 'export PATH=~/.act/bin:$PATH' >> ~/.zshrc
source ~/.zshrc

# Verify integration
which act
act --version
```

## Performance Issues

### Slow Context Operations
**Problem**: Context commands are slow or hang

**Diagnosis**:
```bash
# Check context size
act context list
du -sh ~/.act/context/

# Monitor system resources
top
df -h
```

**Solution**:
```bash
# Clear large context
act context clear

# Use selective file addition
act context add src/main.js  # instead of src/

# Limit command output
act context add --exec "head -n 100 large-file.log"
```

### Memory Issues
**Problem**: System runs out of memory during operations

**Solution**:
```bash
# Clear context immediately
act context clear

# Use smaller file chunks
split -l 1000 large-file.txt chunk_
act context add chunk_aa

# Monitor memory usage
free -h
```

## Network and Connectivity

### AI Service Unavailable
**Problem**: AI backend reports connection errors

**Solution**:
```bash
# Check network connectivity
ping google.com

# Check AI service status
curl -I https://api.anthropic.com/  # for Claude
curl -I https://api.openai.com/    # for OpenAI

# Try different backend temporarily
act config set ai_backend.command "different-backend"
```

## Debug Mode

### Enable Verbose Output
For debugging any issue:

```bash
# Use debug environment variable
DEBUG=* act context add file.js

# Check log files (if available)
ls ~/.act/logs/

# Run commands step by step
act context clear
act context add --exec "echo test"
act context list
act do "simple prompt"
```

## Getting Help

If troubleshooting steps don't resolve your issue:

1. **Check version**: `act --version`
2. **Clear state**: `rm -rf ~/.act/` (removes all configuration)
3. **Reinstall**: `npm uninstall -g @drmhse/act-cli && npm install -g @drmhse/act-cli`
4. **Report issue**: Create an issue with:
   - Operating system and version
   - Node.js and npm versions
   - Act CLI version
   - Complete error messages
   - Steps to reproduce

## Common Command Patterns

### Safe Command Examples
```bash
# File operations
act context add src/index.js
act context add package.json README.md

# Directory listing
act context add --exec "ls -la"
act context add --exec "find . -name '*.js' -type f"

# Git operations
git add .
act context add --diff

# System information
act context add --exec "uname -a"
act context add --exec "node --version"
```

### Workflow Recovery
```bash
# Complete reset
rm -rf ~/.act/
npm uninstall -g @drmhse/act-cli
npm install -g @drmhse/act-cli
act init

# Minimal test
act context add --exec "echo hello"
act context list
act do "What does this output mean?"
```