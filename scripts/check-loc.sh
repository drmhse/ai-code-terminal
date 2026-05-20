#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIMIT="${ACT_LOC_LIMIT:-1000}"
failed=0

check_tree() {
  local label="$1"
  local dir="$2"
  local pattern="$3"

  while IFS= read -r -d '' file; do
    local lines
    lines="$(wc -l < "$file" | tr -d ' ')"
    if (( lines > LIMIT )); then
      printf '%s file exceeds %s LOC: %s (%s)\n' "$label" "$LIMIT" "${file#$ROOT/}" "$lines"
      failed=1
    fi
  done < <(find "$ROOT/$dir" -type f -name "$pattern" -print0)
}

check_tree "Frontend" "frontend/lib/src" "*.dart"

exit "$failed"
