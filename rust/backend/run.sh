#!/bin/bash

# Run script for ACT Rust backend
# This script makes it easy to run either the server or CLI

set -e

cd "$(dirname "$0")"

if [ $# -eq 0 ]; then
    echo "🚀 Starting ACT server (default)..."
    cargo run --package act-server
elif [ "$1" = "server" ] || [ "$1" = "s" ]; then
    echo "🚀 Starting ACT server..."
    cargo run --package act-server
elif [ "$1" = "cli" ] || [ "$1" = "c" ]; then
    shift
    echo "🔧 Running ACT CLI..."
    cargo run --package act-cli -- "$@"
elif [ "$1" = "help" ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "ACT Rust Backend Run Script"
    echo ""
    echo "Usage:"
    echo "  ./run.sh           - Start the ACT server (default)"
    echo "  ./run.sh server     - Start the ACT server"
    echo "  ./run.sh cli        - Run the ACT CLI"
    echo "  ./run.sh cli help   - Show CLI help"
    echo ""
    echo "Examples:"
    echo "  ./run.sh cli create-workspace my-project"
    echo "  ./run.sh cli list-workspaces"
    echo ""
    echo "Environment Variables:"
    echo "  RUST_LOG=debug     - Enable debug logging"
    echo "  RUST_LOG=info      - Enable info logging (default)"
else
    echo "Unknown command: $1"
    echo "Use './run.sh help' for usage information"
    exit 1
fi