#!/bin/bash

# Set environment variable to indicate Tauri mode
export TAURI_ENV_PLATFORM=macos

# Run Tauri dev
cd "$(dirname "$0")/.." && npm run tauri dev
