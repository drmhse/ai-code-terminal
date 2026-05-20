#!/usr/bin/env sh
set -eu

flutter build web --pwa-strategy=none "$@"
cp web/flutter_service_worker.js build/web/flutter_service_worker.js
