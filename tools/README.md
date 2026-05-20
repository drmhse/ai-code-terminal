# Development Tools

Small utilities for local ACT Flutter development.

## `dev.mjs`

Starts a Flutter target with public client configuration. It does not start or
build the ACT backend because backend source is not included in this repository.
Point the client at a running ACT server with `ACT_API_BASE_URL`.

No tool in this directory should commit JWT private keys, API keys, personal
device identifiers, or account-specific deployment values.
