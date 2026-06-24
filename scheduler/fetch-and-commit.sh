#!/usr/bin/env bash
# claude-pulse — fetch and commit (self-healing)
# Shared core script used by the macOS and Linux/WSL schedulers.
#
# Flow: recover → guard → sync → fetch → commit → push
#
# Designed so that multiple machines can run this against the same repo:
# conflicts limited to data/ are resolved automatically (history entries
# are unioned, snapshots newest-wins), a rebase left behind by a crashed
# run is aborted on the next run, and a failed push is retried after
# re-syncing. The repo is never left wedged.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG="$REPO_ROOT/scheduler/fetch.log"
MERGER="$REPO_ROOT/scheduler/merge-data.cjs"
MAX_LOG_LINES=500

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG"; }

# Rotate log if too large
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt "$MAX_LOG_LINES" ]; then
  tail -n $((MAX_LOG_LINES / 2)) "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

log "=== claude-pulse fetch ==="

in_rebase() {
  [ -d "$(git rev-parse --git-path rebase-merge)" ] ||
  [ -d "$(git rev-parse --git-path rebase-apply)" ]
}

# ── 0. Recover from a previous wedged run ──────────────────────────────────
if in_rebase; then
  git rebase --abort >/dev/null 2>&1 || true
  log "recovered: aborted stale rebase left by a previous run"
fi
if [ -f "$(git rev-parse --git-path MERGE_HEAD)" ]; then
  git merge --abort >/dev/null 2>&1 || true
  log "recovered: aborted stale merge left by a previous run"
fi

# ── 1. Branch detection — gate git writes, NOT the local refresh ───────────
# The statusline reads data/usage.json directly, so it MUST be refreshed every
# run regardless of the current branch. Only the remote sync + commit + push
# are gated to `main` — that's what keeps snapshots off feature branches.
# (Previously the whole run aborted off-main, silently freezing the statusline
# for the entire duration of any feature branch.)
CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo 'detached')"
if [ "$CURRENT_BRANCH" = "main" ]; then
  ON_MAIN=true
else
  ON_MAIN=false
  log "off-main ('$CURRENT_BRANCH'): will refresh local data/ only — skipping sync/commit/push"
fi

# ── 2. Conflict resolution helpers ─────────────────────────────────────────
# `git rebase --continue` refuses an empty commit; skip it instead.
continue_or_skip() {
  GIT_EDITOR=true git rebase --continue >/dev/null 2>&1 && return 0
  git rebase --skip >/dev/null 2>&1 && return 0
  return 1
}

# During a rebase, :2: (ours) is the remote side and :3: (theirs) is the
# local commit being replayed. Both are machine-generated snapshots, so
# merge-data.cjs can combine them; if it can't, keep the local side.
resolve_data_conflicts() {
  local rounds=0 f conflicted
  while in_rebase; do
    rounds=$((rounds + 1))
    if [ "$rounds" -gt 10 ]; then
      log "resolver exceeded 10 rounds — aborting rebase"
      git rebase --abort >/dev/null 2>&1 || true
      return 1
    fi
    conflicted="$(git diff --name-only --diff-filter=U)"
    if [ -z "$conflicted" ]; then
      continue_or_skip || { git rebase --abort >/dev/null 2>&1 || true; return 1; }
      continue
    fi
    while IFS= read -r f; do
      case "$f" in
        data/history.json|data/usage.json)
          if git show ":2:$f" > "$f.ours.tmp" 2>/dev/null &&
             git show ":3:$f" > "$f.theirs.tmp" 2>/dev/null &&
             node "$MERGER" "$f" "$f.ours.tmp" "$f.theirs.tmp" 2>/dev/null; then
            log "auto-resolved $f (merged both sides)"
          else
            git checkout --theirs -- "$f" 2>/dev/null ||
              git checkout --ours -- "$f" 2>/dev/null || true
            log "auto-resolved $f (kept one side — merge helper unavailable)"
          fi
          rm -f "$f.ours.tmp" "$f.theirs.tmp"
          git add "$f"
          ;;
        *)
          log "conflict in non-data file '$f' — aborting rebase; resolve manually"
          git rebase --abort >/dev/null 2>&1 || true
          return 1
          ;;
      esac
    done <<< "$conflicted"
    continue_or_skip || { git rebase --abort >/dev/null 2>&1 || true; return 1; }
  done
  return 0
}

sync_with_remote() {
  if git pull --rebase --autostash >/dev/null 2>&1; then
    return 0
  fi
  if in_rebase; then
    resolve_data_conflicts
    return $?
  fi
  return 1  # offline, auth failure, etc.
}

# ── 3. Sync BEFORE fetching new data — minimizes the conflict window ───────
# Only on main: a rebase-pull on a feature branch would rewrite the user's work.
if [ "$ON_MAIN" = true ]; then
  if sync_with_remote; then
    log "synced with remote"
  else
    log "WARN: sync failed (offline or unresolvable conflict) — continuing with local state"
  fi
fi

# Guard: a corrupt history.json would crash the fetch CLI on every run.
if [ -f data/history.json ] && ! node -e 'JSON.parse(require("fs").readFileSync("data/history.json","utf8"))' 2>/dev/null; then
  git checkout HEAD -- data/history.json 2>/dev/null || true
  log "recovered: restored corrupt data/history.json from HEAD"
fi

# ── 4. Fetch & write data/ ─────────────────────────────────────────────────
if [ -f "core/dist/cli.js" ]; then
  node "core/dist/cli.js" fetch && log "fetch: OK" || log "fetch: FAILED (non-zero exit)"
elif command -v claude-pulse &>/dev/null; then
  claude-pulse fetch && log "fetch (global cli): OK" || log "fetch: FAILED"
else
  log "ERROR: cannot find core/dist/cli.js or claude-pulse in PATH — skipping fetch"
  exit 1
fi

# ── 5–7. Commit & push — main only. Off-main we stop here: data/ is already
# refreshed locally (which is all the statusline needs), and we never want a
# usage-snapshot commit landing on a feature branch.
if [ "$ON_MAIN" != true ]; then
  log "off-main: local data/ refreshed — done (no commit/push)"
  exit 0
fi

# ── 5. Stage explicit allowlist only — mirrors vite copyDataPlugin whitelist
git add data/usage.json data/history.json

# ── 6. Commit if there are staged changes ──────────────────────────────────
if git diff --cached --quiet; then
  log "data/ unchanged — nothing to commit"
else
  git commit -m "chore: update usage snapshot $(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
             --no-verify >/dev/null
  log "committed: $(git rev-parse --short HEAD)"
fi

# ── 7. Push, re-syncing and retrying if another machine pushed first ───────
pushed=false
for attempt in 1 2 3; do
  if git push >/dev/null 2>&1; then
    pushed=true
    break
  fi
  log "push rejected (attempt $attempt) — re-syncing"
  sync_with_remote || break
done

if [ "$pushed" = true ]; then
  log "pushed OK"
else
  log "push FAILED — local commit is safe; next run will re-sync and retry"
fi
