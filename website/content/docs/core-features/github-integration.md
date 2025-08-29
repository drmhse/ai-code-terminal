---
title: "GitHub Integration"
description: "Seamless repository access with automatic Git authentication"
weight: 40
layout: "docs"
---

# GitHub Integration

Connect your GitHub account and access all your repositories with zero configuration. Our OAuth credential helper means you'll never need to manage SSH keys or personal access tokens again.

## One-Click Repository Access

**Browse All Your Repositories**
After logging in with GitHub, browse all your repositories—public, private, and organization repos—right from the workspace selector. Use the search bar to quickly find the project you want to work on.

**Instant Workspace Creation**
Click any repository to create a workspace. The system automatically clones the repository and sets up your development environment. No manual `git clone` commands needed.

**Smart Repository Info**
Each repository shows helpful information like the primary programming language, last update time, and description, so you can easily identify the project you're looking for.

## The Magic: OAuth Credential Helper

> **🎉 This is the killer feature!** Once you're authenticated, all Git operations just work. No SSH key setup, no personal access tokens, no credential configuration.

**Never Configure Git Again**
Just use Git normally and everything works automatically:

```bash
git push origin main        # ✅ Works automatically
git pull origin develop     # ✅ No authentication prompts  
git fetch --all            # ✅ Seamless access to all remotes
git clone <private-repo>    # ✅ Private repositories work instantly
```

**What This Means for You:**
- No more "Permission denied (publickey)" errors
- No more managing SSH keys across different machines  
- No more creating and managing personal access tokens
- No more typing passwords or usernames for Git operations

**How It Works Behind the Scenes**
Our custom credential helper automatically provides your GitHub OAuth token to Git whenever needed. When your token expires, it's automatically refreshed. You'll never see authentication errors or password prompts.

**Perfect for Multiple Repositories**
Work across multiple repositories without any additional setup. Clone new repositories, add upstream remotes for forks, push to different branches—everything works seamlessly.

## Why This Matters

**No More Authentication Headaches**
Stop wrestling with SSH keys, personal access tokens, or credential managers. Focus on your code instead of your configuration.

**Works Everywhere**
Access your private repositories from any device where you run AI Code Terminal. The authentication follows your account, not your device.

**Secure by Design**
Your GitHub credentials are encrypted and stored securely. We never store passwords or SSH keys—only OAuth tokens that can be revoked at any time from your GitHub settings.

**Always Up-to-Date**
Tokens are automatically refreshed, so you'll never experience authentication failures due to expired credentials.

## Getting Started

1. **Login with GitHub:** Click "Login with GitHub" on the main screen
2. **Authorize Access:** Grant the application permission to access your repositories
3. **Browse Repositories:** Use the repository browser to find your project
4. **Create Workspace:** Click any repository to clone it and start coding
5. **Use Git Normally:** All Git commands work automatically without any setup

## Repository Management

**Organization Access**
If you're part of GitHub organizations, you'll see all accessible organization repositories alongside your personal repos.

**Fork Support**
Working with forks? The system handles upstream remotes automatically. Add upstream remotes and push to different repositories without any authentication setup.

**Branch Management**
Create, switch, and push branches normally. The credential helper works with all Git operations, including complex workflows with multiple remotes.

## Pro Tips

**Repository Search**
Use the repository search to quickly find projects by name. Especially useful if you have many repositories or are part of large organizations.

**Fresh Workspaces**
Each workspace is a fresh clone, so you can have multiple workspaces for the same repository if needed—perhaps for different branches or experiments.

**Git Commands Work Normally**
Don't change your Git workflow. All standard Git commands work exactly as you'd expect, just without the authentication hassle.

**Automatic User Configuration**
Your Git user name and email are automatically configured from your GitHub profile, so commits are properly attributed without any manual setup.

## Security Features

**Single-Tenant Access**
Only the configured GitHub user can access the system. Even if someone else has the URL, they can't log in unless they're the authorized user.

**Encrypted Token Storage**
Your OAuth tokens are encrypted and stored securely. They're never logged or exposed in any way.

**Revokable Access**
You can revoke the application's access to your GitHub account at any time from your GitHub settings page, immediately invalidating all stored tokens.

**Minimal Permissions**
The application requests only the minimum necessary permissions: access to your repositories and basic profile information for Git configuration.

This seamless integration means you spend more time coding and less time fighting with authentication. Just log in once and start working with any of your repositories immediately.