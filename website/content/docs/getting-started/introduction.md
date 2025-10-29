---
title: "Introduction"
description: "Overview of AI Code Terminal and its core capabilities"
weight: 10
layout: "docs"
---

# Introduction

AI Code Terminal is a production-ready, single-tenant development environment that provides god-mode shell access through your browser. Built with security and simplicity in mind, it offers a complete terminal interface for a single authorized GitHub user to work directly in their repositories with integrated Claude Code support.

## What Makes AI Code Terminal Special

1. **Terminal Multiplexing (Tabs & Split Panes):** Work with multiple terminals side-by-side. Run your dev server in one pane, tests in another, and Git commands in a third—all in the same window.

2. **Integrated File Explorer:** Built-in sidebar with file browser, preview capabilities, and context menus. Navigate your codebase without leaving the terminal interface.

3. **Seamless GitHub Integration:** Clone repositories with one click. Our OAuth credential helper means you never worry about SSH keys or personal access tokens for `git push/pull`.

4. **Secure, Private, Single-Tenant Design:** Your own isolated development environment. No shared resources, no data mixing, enterprise-grade security for one user.

5. **Direct Claude Code Integration:** Run `claude login` directly in your terminal. Your API key stays on your machine—we never store or see it.

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

Built with modern web technologies for reliability and performance:
- **Real-time terminals** powered by xterm.js and Socket.IO
- **Docker containerization** for security and isolation
- **GitHub OAuth** for seamless authentication and Git operations
- **SQLite database** for lightweight data persistence

## Architecture Philosophy

**Security First, Developer Second:** Every feature prioritizes your data privacy and coding productivity.