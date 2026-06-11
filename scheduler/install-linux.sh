#!/usr/bin/env bash
# claude-pulse — Linux / WSL cron installer
# Adds a crontab entry that runs fetch-and-commit.sh every 15 minutes.
# Run once (no sudo needed — runs under current user's crontab):
#   bash scheduler/install-linux.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FETCH_SCRIPT="$REPO_ROOT/scheduler/fetch-and-commit.sh"
CRON_TAG="# claude-pulse-fetch"

chmod +x "$FETCH_SCRIPT"

# Resolve node and git paths for the cron environment (which has minimal PATH)
NODE_BIN="$(command -v node 2>/dev/null || echo /usr/local/bin/node)"
GIT_BIN="$(command -v git 2>/dev/null || echo /usr/bin/git)"
NODE_DIR="$(dirname "$NODE_BIN")"
GIT_DIR="$(dirname "$GIT_BIN")"

CRON_PATH="$NODE_DIR:$GIT_DIR:/usr/local/bin:/usr/bin:/bin"

# The cron line: */15 * * * * = every 15 minutes
CRON_LINE="*/15 * * * * PATH=$CRON_PATH HOME=$HOME $FETCH_SCRIPT >> $REPO_ROOT/scheduler/cron.log 2>&1 $CRON_TAG"

# Remove existing claude-pulse entry, then append the new one
(
  crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true
  echo "$CRON_LINE"
) | crontab -

echo ""
echo "Cron entry installed:"
echo "  $CRON_LINE"
echo ""
echo "To verify: crontab -l | grep claude-pulse"
echo ""
echo "To uninstall:"
echo "  crontab -l | grep -v '${CRON_TAG}' | crontab -"
