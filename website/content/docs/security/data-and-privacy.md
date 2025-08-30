---
title: "Data and Privacy"
description: "Understanding data storage, privacy, and control in your self-hosted installation"
weight: 10
layout: "docs"
---

# Data and Privacy

AI Code Terminal is designed with privacy-first principles for self-hosted installations. As the person running this software, you have complete control over all data storage and processing.

## Data Stored by Your Installation

**Application Settings**
Your installation stores minimal settings locally:
- **Encrypted GitHub OAuth tokens** - For seamless Git operations
- **Theme preferences** - Your chosen terminal and interface themes
- **GitHub profile information** - Name and email for Git configuration

**Workspace Information**  
A record of your development environments:
- **Repository metadata** - Names and URLs of cloned repositories
- **Workspace timestamps** - Creation and last access times
- **Cleanup schedules** - For automatic maintenance of unused workspaces

**Terminal Session Data**
Information to maintain persistent terminal sessions:
- **Session identifiers** - For reconnecting to existing terminals
- **Session state** - Active/inactive status and basic metadata
- **Layout configurations** - Your terminal multiplexing preferences

## Data Never Stored Locally

**Source Code in Database**
Your actual code remains on the filesystem:
- **Filesystem storage only** - Code exists in workspace directories
- **No database persistence** - Source code never enters the SQLite database
- **Standard Git operations** - All code management through Git

**AI Conversations by AI Code Terminal**
Your Claude interactions remain private from the application:
- **No conversation logging** - AI Code Terminal does not record AI interactions
- **No response caching** - Claude responses are not stored by AI Code Terminal
- **End-to-end privacy** - AI communication bypasses the AI Code Terminal application server

**Claude API Credentials**
Claude Code manages API keys in its standard way:
- **Standard Claude Code storage** - API keys stored in Claude Code's configuration (~/.config/claude)
- **Container persistence** - Keys persist in the user's home directory within the container
- **AI Code Terminal isolation** - The application never accesses or processes Claude credentials

**Authentication Credentials**
Secure authentication without credential storage:
- **OAuth-only flow** - No passwords or personal access tokens stored
- **No SSH key management** - OAuth handles all Git authentication
- **Secure token handling** - Encrypted tokens with automatic refresh

## Data Protection Methods

**Local Encryption**
Sensitive data is encrypted within your installation:
- **AES-256-CBC encryption** - Industry-standard encryption for OAuth tokens
- **Installation-specific keys** - Unique encryption keys per deployment
- **Secure key storage** - Keys isolated from encrypted data

**Network Security**
All communications are encrypted in transit:
- **TLS encryption** - HTTPS for all web interface traffic
- **Secure WebSockets** - Encrypted real-time terminal communications
- **API security** - All external API calls use encrypted connections

**Access Control**
Multiple security layers protect your installation:
- **Single-user authentication** - Only your configured GitHub username can access
- **Session management** - Secure JWT tokens with configurable expiration
- **Container isolation** - Docker containers isolate processes and data
- **Filesystem permissions** - Restricted file access within containers

## Data Storage Locations

**Local Data Storage**
All data remains within your installation:
- **SQLite database** - Local file in your configured data directory
- **Workspace files** - Individual directories for each cloned repository
- **Application logs** - Local log files with configurable retention
- **Session data** - Temporary files and memory-based storage

**External Communication**
Limited external connections for essential functionality:
- **GitHub OAuth** - Authentication and repository access only
- **GitHub API** - Repository browsing and Git operations
- **Claude API** - Only when you initiate AI assistance
- **No analytics** - No usage data sent to external services

## Data Retention Policies

**Automatic Maintenance**
Your installation handles data cleanup automatically:
- **Workspace cleanup** - Configurable removal of inactive workspaces (default: 30 days)
- **Session cleanup** - Automatic cleanup of terminated terminal sessions
- **Log rotation** - Configurable log file retention and rotation
- **Token refresh** - Automatic OAuth token refresh and cleanup

**Manual Data Control**
Complete control over your data:
- **Workspace deletion** - Remove any workspace and its data instantly
- **Session termination** - End terminal sessions and clear associated data
- **Configuration changes** - Modify retention policies and cleanup schedules
- **Complete removal** - Revoking GitHub OAuth removes all associated data

## Self-Hosted Privacy Model

**Single-Tenant Architecture**
Designed for individual control:
- **One authorized user** - Only your GitHub account can access the system
- **No shared resources** - Each installation is completely isolated
- **Personal deployment** - You control the hosting environment and policies
- **Data sovereignty** - All data remains under your direct control

**Open Source Transparency**
Complete visibility into data handling:
- **Auditable code** - Every aspect of data processing is visible
- **No hidden functionality** - All features are documented and transparent
- **Community oversight** - Open source enables security review
- **Modifiable** - You can modify data handling to meet your requirements

## Your Control and Rights

**Complete Data Ownership**
As the self-hoster, you maintain full control:
- **Direct access** - All data is stored in your controlled environment
- **Export capabilities** - Standard tools can export all data
- **Deletion authority** - Remove any or all data at will
- **Audit capabilities** - Full visibility into what data exists and where

**Privacy by Design**
Every feature respects your privacy:
- **Minimal collection** - Only essential data for functionality
- **Local processing** - Operations happen within your installation
- **User-controlled sharing** - You decide what data to share and when
- **No vendor dependencies** - No reliance on external services for core functionality

**Customizable Policies**
Adapt the system to your privacy requirements:
- **Configurable retention** - Adjust data cleanup schedules
- **Selective logging** - Control what information is logged
- **Security settings** - Customize encryption and access controls
- **External integrations** - Choose which external services to use

This self-hosted model ensures you maintain complete control over your development environment, source code, and AI interactions while benefiting from a powerful, integrated development experience.