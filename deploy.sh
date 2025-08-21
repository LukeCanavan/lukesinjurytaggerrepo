#!/usr/bin/env bash
set -euo pipefail

# Variables (override via env)
APP_DIR=${APP_DIR:-/var/www/injury}
REPO_URL=${REPO_URL:-git@github.com:YOUR_ORG/YOUR_REPO.git}
BRANCH=${BRANCH:-main}
NODE_VERSION=${NODE_VERSION:-18}

if ! command -v git >/dev/null 2>&1; then echo "git required"; exit 1; fi
if ! command -v node >/dev/null 2>&1; then echo "Install Node $NODE_VERSION first"; exit 1; fi

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -d repo ]; then
  git clone --branch "$BRANCH" "$REPO_URL" repo
fi
cd repo

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --rebase origin "$BRANCH"

# Install backend deps
pushd backend
npm ci --omit=dev
popd

# Install + build frontend
pushd frontend
npm ci
npm run build
popd

# Prepare data directory
mkdir -p shared/data
# Symlink backend data directory
rm -rf backend/data || true
ln -s ../shared/data backend/data

# PM2
if ! command -v pm2 >/dev/null 2>&1; then npm install -g pm2; fi
APP_VERSION=$(git rev-parse --short HEAD) CORS_ORIGIN="https://$DOMAIN" pm2 startOrReload backend/ecosystem.config.cjs --update-env
pm2 save

echo "Deploy complete $(date)"
