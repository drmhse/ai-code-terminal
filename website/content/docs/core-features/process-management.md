---
title: "Process Management" 
description: "Automatic supervision of long-running development processes"
weight: 30
layout: "docs"
---

# Process Management

Ever started a development server, closed your laptop, and came back to find it stopped? Our Process Supervisor automatically tracks and manages your long-running development processes, so they keep running even when you disconnect.

## How It Works

**Automatic Process Detection**
The system automatically recognizes and tracks common development processes when you start them:
- Development servers (`npm run dev`, `yarn start`, `vite`)
- Build tools (`webpack --watch`, `rollup --watch`)
- Test watchers (`jest --watch`, `npm run test:watch`)
- Database connections and servers
- Custom long-running scripts

**Background Supervision**
Once detected, these processes are supervised in the background. They continue running even if:
- You close your browser
- Your internet connection drops
- You disconnect from the session
- The browser crashes or refreshes

**Process Recovery**
If a supervised process crashes or stops unexpectedly, the system can automatically restart it based on your preferences.

## Why This Matters

**Never Lose Development State**
Start your development server, run your tests, and work with confidence knowing everything will keep running. Close your laptop for a meeting and return to find your development environment exactly as you left it.

**Perfect for Remote Work**
Working from coffee shops with spotty WiFi? No problem. Your development processes keep running on the server even when your connection drops.

**Long-Running Operations**
Start a large build process or data migration and let it run while you work on other things. Come back later to check the results without babysitting the terminal.

**Multi-Device Development**
Start a process on your laptop, then continue monitoring it from your tablet or phone. The processes run independently of your client device.

## Supported Process Types

**Web Development**
- `npm run dev` / `npm start`
- `yarn dev` / `yarn start` 
- `vite` / `vite dev`
- `next dev` / `next start`
- `nuxt dev` / `nuxt start`
- `gatsby develop`

**Build Tools**
- `webpack --watch`
- `rollup --watch --config`
- `parcel watch`
- `esbuild --watch`

**Testing**
- `jest --watch`
- `npm run test:watch`
- `vitest --watch`
- `cypress open`

**Databases and Services**
- Local database servers
- Redis servers
- Docker containers
- Custom daemon processes

## Managing Your Processes

**View Running Processes**
See all your supervised processes at a glance. Each process shows:
- Current status (running, stopped, crashed)
- How long it's been running
- Resource usage (CPU, memory)
- Recent output/logs

**Control Actions**
For each supervised process, you can:
- **Restart:** Stop and start the process
- **Stop:** Terminate the process
- **View Logs:** See recent output and error messages
- **Remove Supervision:** Stop tracking the process

**Process Notifications**
Get notified when important events happen:
- Process crashes or stops unexpectedly
- Process consumes excessive resources
- Process has been restarted automatically

## Getting Started

1. **Start a Long-Running Process:** Run any development command like `npm run dev`
2. **Automatic Detection:** The system automatically recognizes and begins supervising it
3. **Continue Working:** The process continues running even if you disconnect
4. **Check Status:** View your processes in the Process Management panel
5. **Manage as Needed:** Restart, stop, or monitor your processes

## Pro Tips

**Process Naming**
The system automatically names processes based on the command and working directory. Processes running in different projects are tracked separately.

**Resource Monitoring**
Keep an eye on resource usage to ensure your processes aren't consuming excessive CPU or memory. The system provides warnings for resource-heavy processes.

**Selective Supervision**
Not every command needs supervision. The system is smart about which processes to track—typically only long-running development tools, not quick commands like `ls` or `git status`.

**Process Persistence**
Supervised processes persist across server restarts when possible. This means even server maintenance won't interrupt your development workflow.