#!/bin/bash

# Set environment variable to indicate Tauri mode
export TAURI_ENV_PLATFORM=macos

# Run Tauri build
cd "$(dirname "$0")/.." && npm run tauri build
