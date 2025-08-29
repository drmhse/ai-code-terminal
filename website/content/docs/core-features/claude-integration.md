---
title: "Claude Integration"
description: "Run Claude Code directly in your secure terminal environment"
weight: 50
layout: "docs"
---

# Claude Integration

AI Code Terminal comes with Claude Code pre-installed, so you can use AI assistance directly in your secure terminal environment. Your API key stays completely private—we never store it on our servers.

## How It Works

**Pre-Installed Claude Code**
Claude Code is already installed and ready to use in every workspace. No installation, configuration, or setup required.

**Your API Key, Your Control**
When you're ready to use Claude Code, simply run:

```bash
claude login
```

This authenticates directly with Anthropic using your own API key. Crucially: your API key is stored locally in your terminal session and never touches our servers.

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

**Complete Privacy**
Your Claude API key and all your interactions with Claude remain completely private:
- **We never see your API key** - Authentication happens directly between you and Anthropic
- **We never store your key** - Keys are managed locally in your terminal session
- **Your conversations stay private** - No server-side logging or storage of Claude interactions

**Zero Configuration**
Unlike other platforms where you might need to configure API keys through web interfaces or settings pages, here you manage everything directly through the familiar Claude Code CLI.

**Secure Environment**
Your code and AI interactions happen in an isolated, secure environment. Even if you're working on sensitive projects, your data never leaves the secure container.

**Always Up-to-Date**
We keep Claude Code updated to the latest version, so you always have access to the newest features and improvements.

## Getting Started

1. **Access Your Workspace:** Create or open any workspace
2. **Login to Claude:** Run `claude login` in your terminal
3. **Enter Your API Key:** Follow the prompts to authenticate with your Anthropic API key
4. **Start Using Claude:** Run `claude chat` or any other Claude Code commands

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

> **🔒 Security Highlight**
> 
> This is the most important feature: **your API key is completely under your control**. Unlike platforms that require you to enter API keys through web forms, here you manage everything through the secure Claude Code CLI.

**Best Practices:**
- Keep your API key secure and don't share it
- You can revoke or rotate API keys through your Anthropic dashboard at any time
- If you stop using a workspace, your API key is automatically cleared when the session ends

**No Server-Side Storage:**
We deliberately designed the system so that:
- AI Code Terminal servers never see or store your API key
- All Claude interactions happen directly between your terminal and Anthropic's servers
- Your API usage and billing are handled directly through your Anthropic account

## Why We Built It This Way

**Privacy First**
By letting you manage your own API key through the Claude Code CLI, we ensure that your AI interactions remain completely private. Even we can't see what you're asking Claude or how you're using the service.

**Familiar Workflow**
If you already use Claude Code locally, this works exactly the same way. No new tools to learn or different authentication methods.

**Security by Design**
Your sensitive code and AI interactions never leave the secure, isolated environment. Even if you're working on proprietary or confidential projects, everything stays contained.

**No Vendor Lock-in**
Since you manage your own API key and use the standard Claude Code interface, you're never locked into our platform. You can use your API key with any Claude Code installation.

This approach gives you all the benefits of AI assistance while maintaining complete control over your privacy and security.