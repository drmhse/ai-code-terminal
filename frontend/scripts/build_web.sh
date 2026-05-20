#!/usr/bin/env sh
set -eu

flutter build web --pwa-strategy=none "$@"
cp web/flutter_service_worker.js build/web/flutter_service_worker.js

grep -q 'property="og:image" content="https://act.drmhse.com/social-preview.png"' build/web/index.html
grep -q 'name="twitter:card" content="summary_large_image"' build/web/index.html
test -f build/web/social-preview.png
