---
title: "Data and Privacy"
description: "What data we store, what we don't, and how we protect your privacy"
weight: 10
layout: "docs"
---

# Data and Privacy

Your data privacy and security are fundamental to how AI Code Terminal is designed. Here's exactly what data we store, what we never store, and how we keep everything secure.

## What We Store

**Your Settings**
We store minimal settings to make your experience consistent:
- **Your encrypted GitHub tokens** - So you don't have to re-authenticate constantly
- **Your theme preference** - Dark, light, or high-contrast themes
- **Basic profile info from GitHub** - Your name and email for Git configuration

**Your Workspaces**
A simple list of the repositories you've cloned:
- **Repository names** - Which GitHub repositories you've worked with
- **Workspace creation dates** - When you first cloned each repository
- **Last access times** - To help clean up unused workspaces

**Your Terminal Sessions**
Information to help you recover your work:
- **Session identifiers** - So you can reconnect to existing terminals
- **Active session count** - To manage resource usage
- **Session status** - Whether sessions are active or closed

## What We Never Store

**Your Source Code**
Your actual code never enters our database:
- **Code lives on the filesystem** - In isolated workspace directories  
- **No database storage** - We never save your code files to the database
- **Git repositories stay local** - Cloned repos exist only in your workspace

**Your Claude API Key**
This is crucial for privacy:
- **You manage your own key** - Through the `claude login` command directly
- **No server-side storage** - We never see or store your Claude API key
- **Direct authentication** - Your key goes directly to Anthropic, not through us

**Your AI Conversations**
Your interactions with Claude remain completely private:
- **No conversation logging** - We never see what you ask Claude
- **No response storage** - Claude responses don't touch our servers  
- **Direct communication** - Your terminal talks directly to Anthropic's API

**Your Personal Access Tokens or SSH Keys**
We use OAuth tokens instead:
- **No manual token entry** - Our OAuth flow handles authentication
- **No SSH key storage** - Everything works through secure OAuth tokens
- **No password storage** - We never ask for or store passwords

## How We Protect Your Data

**Encryption at Rest**
All sensitive data is encrypted in our database:
- **AES-256-CBC encryption** - Military-grade encryption for stored tokens
- **Unique encryption keys** - Each installation uses its own encryption keys
- **Secure key management** - Encryption keys stored separately from data

**Encryption in Transit**
All communication is secured:
- **HTTPS everywhere** - All web traffic encrypted with TLS
- **Secure WebSocket connections** - Terminal sessions encrypted in real-time  
- **API security** - GitHub API calls always use HTTPS

**Access Control**
Your data is protected by multiple security layers:
- **Single-tenant authentication** - Only you can access your data
- **JWT tokens** - Secure session management with expiring tokens
- **GitHub OAuth** - Leveraging GitHub's security for authentication
- **Container isolation** - Your workspaces run in isolated Docker containers

## Data Locations

**Where Your Data Lives**
All data stays within your AI Code Terminal instance:
- **Local SQLite database** - Stored in your deployment's data directory
- **Workspace files** - Stored in isolated filesystem directories  
- **Session data** - Managed in memory and local storage only

**No Third-Party Data Sharing**
Your data never leaves your AI Code Terminal instance except:
- **GitHub OAuth flow** - Only for authentication with GitHub
- **Claude API calls** - Only when YOU initiate them with YOUR API key
- **No analytics** - We don't send usage data to third parties
- **No tracking** - No external analytics or tracking services

## Data Retention

**Automatic Cleanup**
We automatically clean up old data to protect your privacy:
- **Inactive workspace cleanup** - Old workspaces removed after 30 days (configurable)
- **Expired session cleanup** - Terminated sessions cleaned up automatically  
- **Token refresh** - Expired OAuth tokens automatically refreshed or removed

**Manual Data Control**
You have full control over your data:
- **Delete workspaces** - Remove any workspace and its data at any time
- **Clear sessions** - Terminate and clean up terminal sessions
- **Revoke GitHub access** - Remove OAuth permissions from your GitHub settings
- **Full data removal** - Deleting your GitHub OAuth app removes all associated data

## Single-Tenant Security Model

**Designed for One User**
AI Code Terminal is built as a personal development environment:
- **One authorized user** - Only your GitHub username can access the system
- **No multi-user complexity** - No user separation or permission management needed
- **Personal instance** - Each deployment serves exactly one developer
- **Complete isolation** - No shared resources or data between different deployments

## Transparency Commitments

**Open Source**
The entire codebase is open source:
- **Full transparency** - You can audit exactly how data is handled
- **No hidden features** - Everything is visible in the source code
- **Community oversight** - Security reviewed by the open source community

**No Surprises**
We commit to:
- **No data collection changes** - Any changes to data handling will be clearly documented
- **No hidden data storage** - If we store it, it's documented here
- **No third-party data sharing** - Your data stays within your AI Code Terminal instance

## Your Rights and Control

**Full Data Control**
You maintain complete control:
- **Access your data** - Everything is stored in your deployment
- **Export your data** - Standard Git operations export your code
- **Delete your data** - Remove workspaces and OAuth permissions at any time
- **Audit data usage** - Full source code available for review

**Privacy by Design**
Every feature is built with privacy in mind:
- **Minimal data collection** - We store only what's necessary for functionality
- **Local-first** - Data processing happens locally when possible
- **User-controlled** - You decide what data to share and when

This privacy-first approach means you get all the benefits of a powerful development environment while maintaining complete control over your code, credentials, and AI interactions.