---
title: "Claude Integration"
description: "Run Claude Code directly in your secure terminal environment"
weight: 50
layout: "docs"
---

# Claude Integration

AI Code Terminal comes with Claude Code pre-installed, so you can use AI assistance directly in your secure terminal environment. Your API key is managed by Claude Code in the standard way, stored in your user configuration within the container.

## How It Works

**Pre-Installed Claude Code**
Claude Code is already installed and ready to use in every workspace. No installation, configuration, or setup required.

**Simple Authentication Process**
When you're ready to use Claude Code, simply run:

```bash
claude
```

On first use, Claude Code will guide you through authentication with options for:
- **Anthropic Console (API)** - Pay-per-use API authentication with OAuth process
- **Claude App (Pro/Max)** - Subscription-based authentication using your Claude.ai credentials
- **Enterprise platforms** - Bedrock or Vertex AI integration

Claude Code handles the entire authentication flow, including providing authorization links and token management.

**Ready to Use**
Once authenticated, use Claude Code normally:

```bash
# Start a chat session
claude chat

# Ask specific questions about your code
claude chat "How can I optimize this React component?"

# Get help with your project
claude chat "Help me debug this API endpoint"
```

## Why This Setup Is Perfect

**Secure Authentication**
Your Claude authentication and interactions remain secure:
- **Direct authentication** - Claude Code handles authentication directly with Anthropic
- **Secure credential storage** - Claude Code securely stores credentials using system-level encryption (macOS Keychain on Mac)
- **AI Code Terminal isolation** - The application never accesses your Claude credentials or conversations
- **Standard Claude Code behavior** - Authentication works exactly as it does on any other platform

**Zero Configuration**
Unlike other platforms where you might need to configure API keys through web interfaces or settings pages, here you manage everything directly through the familiar Claude Code CLI.

**Secure Environment**
Your code and AI interactions happen in an isolated, secure environment. Even if you're working on sensitive projects, your data never leaves the secure container.

**Always Up-to-Date**
The Docker installation includes Claude Code updated to the latest version, so you always have access to the newest features and improvements.

## Getting Started

1. **Access Your Workspace:** Create or open any workspace
2. **Start Claude Code:** Run `claude` in your terminal
3. **Choose Authentication:** Select from API Console, Pro/Max subscription, or Enterprise options
4. **Complete Authentication:** Follow the guided process including OAuth authorization if needed
5. **Start Using Claude:** Use `claude chat` or any other Claude Code commands

## Common Usage Patterns

**Code Review and Analysis**
```bash
# Review your changes before committing
claude chat "Can you review the changes I've made?"

# Get feedback on code quality
claude chat "Any suggestions for improving this function?"
```

**Debugging Help**
```bash
# Get help with errors
claude chat "I'm getting this error: [paste error message]"

# Understand complex code
claude chat "Can you explain what this code does?"
```

**Feature Development**
```bash
# Plan new features
claude chat "How should I implement user authentication?"

# Get implementation suggestions
claude chat "What's the best way to structure this API?"
```

## Project Context

**Automatic Project Understanding**
Each workspace automatically includes information about your project in a `CLAUDE.md` file, helping Claude understand your codebase structure and technology stack.

**Smart Assistance**
Claude Code can see your project files and understand your setup, providing more relevant and accurate suggestions based on your specific technology stack.

## API Key Management

> **Security Highlight**
> 
> This is the most important feature: **your API key is completely under your control**. Unlike platforms that require you to enter API keys through web forms, here you manage everything through the secure Claude Code CLI.

**Authentication Management:**
- **Account switching** - Use `/login` command to switch between different Claude accounts
- **Logout** - Use `/logout` command to log out of your current session
- **Credential persistence** - Authentication persists between sessions within the container
- **Multiple options** - Choose between API billing or subscription billing based on your needs

**Standard Claude Code Behavior:**
Claude Code operates normally within the container:
- Credentials stored using Claude Code's standard secure storage mechanisms
- All Claude interactions happen directly between Claude Code and Anthropic's servers  
- Your usage and billing are handled directly through your chosen Anthropic account type
- AI Code Terminal never intercepts, accesses, or processes these interactions

## Design Philosophy

**Privacy First**
By letting you manage your own API key through the Claude Code CLI, this ensures that your AI interactions remain completely private. AI Code Terminal has no visibility into what you're asking Claude or how you're using the service.

**Familiar Workflow**
If you already use Claude Code locally, this works exactly the same way. No new tools to learn or different authentication methods.

**Security by Design**
Your sensitive code and AI interactions never leave the secure, isolated environment. Even if you're working on proprietary or confidential projects, everything stays contained.

**No Vendor Lock-in**
Since you manage your own API key and use the standard Claude Code interface, you're never locked into this platform. You can use your API key with any Claude Code installation.

This approach gives you all the benefits of AI assistance while maintaining complete control over your privacy and security.