#!/usr/bin/env bash
# v1.0.0 — build the app and publish it to nginx. Run on the EC2, from
# anywhere:
#
#   ~/pos_frontend/deploy/deploy.sh
#
# Pulls main, installs exactly what package-lock.json says, builds, and copies
# the build into /var/www/pos-frontend. Files from earlier builds are kept, so
# a tab still open on the old version can load its screens; index.html is
# replaced, so the next load gets the new one. First set-up: deploy/README.md.
set -euo pipefail

TARGET=/var/www/pos-frontend
cd "$(dirname "$0")/.."

# Angular CLI 22 needs Node 22.22.3 or later.
if ! node -e 'const [a, b, c] = process.versions.node.split(".").map(Number);
  process.exit(a > 22 || (a === 22 && (b > 22 || (b === 22 && c >= 3))) ? 0 : 1)'; then
  echo "Node $(node -v) is too old: Angular CLI 22 needs 22.22.3 or later." >&2
  exit 1
fi

git pull --ff-only
npm ci
npx ng build
# index.html last, so it never names a file that is not there yet.
rsync -a --exclude index.html dist/pos_frontend/browser/ "$TARGET/"
rsync -a dist/pos_frontend/browser/index.html "$TARGET/"
echo "Published $(git log -1 --format='%h %s') to $TARGET"
