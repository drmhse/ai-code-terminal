---
title: "Introduction"
description: "Overview of AI Code Terminal and its core capabilities"
weight: 10
layout: "docs"
---

# Introduction

AI Code Terminal is a production-ready, single-tenant development environment that provides god-mode shell access through your browser. Built with security and simplicity in mind, it offers a complete terminal interface for a single authorized GitHub user to work directly in their repositories with integrated Claude Code support.

## What Makes AI Code Terminal Special

- **Browser-based terminal:** Full shell access without installing anything locally
- **Single-tenant security:** Designed for one user with enterprise-grade security
- **Claude Code integration:** Built-in support for AI-assisted coding
- **GitHub-first workflow:** Direct repository cloning and management
- **Real-time collaboration:** WebSocket-powered terminal sessions
- **Container isolation:** Secure, resource-limited execution environment
- **Persistent workspaces:** Your work is automatically saved and restored

## Use Cases

### Remote Development
Code from anywhere with just a browser. Perfect for developers who need access to their development environment from multiple devices or locations.

### Secure Coding
Isolated environment for sensitive projects. All code execution happens in a containerized environment with strict resource limits.

### Cloud Development
Powerful development without local resource constraints. Run resource-intensive builds and tests in the cloud.

### Teaching & Learning
Consistent development environment for education. Instructors can provide students with identical development setups.

### CI/CD Integration
Automated development workflows. Integrate with existing CI/CD pipelines for automated testing and deployment.

## Technical Overview

The application is built with modern web technologies:

- **Backend:** Node.js with Express framework
- **Real-time Communication:** Socket.IO for WebSocket connections
- **Database:** SQLite with Prisma ORM for data persistence
- **Authentication:** GitHub OAuth for secure single-tenant access
- **Terminal:** xterm.js frontend with node-pty backend for full PTY support
- **Containerization:** Docker for secure, isolated execution
- **Frontend:** EJS templating with Vue.js for interactive components

## Architecture Philosophy

AI Code Terminal follows these core principles:

1. **Security First:** Every component is designed with security in mind
2. **Single Tenant:** Optimized for individual developer workflows
3. **Minimal Dependencies:** Keep the system lightweight and maintainable
4. **Cloud Native:** Designed for containerized deployment
5. **Developer Experience:** Focus on making coding faster and more enjoyable