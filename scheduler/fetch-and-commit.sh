#!/usr/bin/env bash
# claude-pulse — fetch and commit
# Shared core script used by all platform schedulers.
# Runs: fetch → stage data/ only → commit (if changed) → push

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG="$REPO_ROOT/scheduler/fetch.log"
MAX_LOG_LINES=500

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG"; }

# Rotate log if too large
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt "$MAX_LOG_LINES" ]; then
  tail -n $((MAX_LOG_LINES / 2)) "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

log "=== claude-pulse fetch ==="

# ── 1. Fetch & write data/ ─────────────────────────────────────────────────
if [ -f "core/dist/cli.js" ]; then
  node "core/dist/cli.js" fetch && log "fetch: OK" || log "fetch: FAILED (non-zero exit)"
elif command -v claude-pulse &>/dev/null; then
  claude-pulse fetch && log "fetch (global cli): OK" || log "fetch: FAILED"
else
  log "ERROR: cannot find core/dist/cli.js or claude-pulse in PATH — skipping fetch"
  exit 1
fi

# ── 2. Stage ONLY data/ — never secrets or the whole tree ─────────────────
git add data/

# ── 3. Commit if there are staged changes ─────────────────────────────────
if git diff --cached --quiet; then
  log "data/ unchanged — nothing to commit"
else
  git commit -m "chore: update usage snapshot $(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
             --no-verify
  log "committed: $(git rev-parse --short HEAD)"
fi

# ── 4. Push ────────────────────────────────────────────────────────────────
git push && log "pushed OK" || log "push FAILED (check remote auth)"
