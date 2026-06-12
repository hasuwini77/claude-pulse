#!/usr/bin/env bash
# claude-pulse — integration test for the self-healing scheduler.
# Builds a bare origin + two clones ("machine A" and "machine B") in a temp
# dir, stubs the fetch CLI, and asserts that fetch-and-commit.sh survives:
#   1. the happy path on both machines
#   2. concurrent snapshots → auto-resolved, history entries from BOTH kept
#   3. a wedged rebase left by a crashed previous run → recovered
#   4. a conflict in a non-data file → aborts safely, repo NOT left wedged
#
# Run: bash scheduler/test-self-healing.sh

set -euo pipefail

SCHED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/claude-pulse-test.XXXXXX")"
trap 'rm -rf "$T"' EXIT

PASS=0; FAIL=0
ok()   { PASS=$((PASS + 1)); echo "  PASS: $*"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $*"; }
assert() { # assert <description> <command...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; else fail "$desc"; fi
}

# ── Fixture ─────────────────────────────────────────────────────────────────
git init --bare -q -b main "$T/origin.git"

make_clone() { # make_clone <name>
  local c="$T/$1"
  git clone -q "$T/origin.git" "$c"
  git -C "$c" config user.name "Test $1"
  git -C "$c" config user.email "$1@test.local"
  mkdir -p "$c/scheduler" "$c/core/dist" "$c/data"
  cp "$SCHED_DIR/fetch-and-commit.sh" "$SCHED_DIR/merge-data.cjs" "$c/scheduler/"
  # Stub fetch CLI: writes a fresh snapshot + appends one history entry
  cat > "$c/core/dist/cli.js" <<'JS'
const fs = require('fs');
const now = new Date().toISOString();
const five = Math.floor(Math.random() * 100);
const wk = Math.floor(Math.random() * 100);
fs.writeFileSync('data/usage.json',
  JSON.stringify({ fetched_at: now, five_hour: { utilization: five }, weekly: { utilization: wk } }, null, 2) + '\n');
const h = JSON.parse(fs.readFileSync('data/history.json', 'utf8'));
h.push({ t: now, five_hour: five, weekly: wk });
fs.writeFileSync('data/history.json', JSON.stringify(h, null, 2) + '\n');
JS
}

make_clone A
# Seed initial state from A
cd "$T/A"
echo '[]' > data/history.json
echo '{"fetched_at":"2026-01-01T00:00:00.000Z"}' > data/usage.json
echo 'seed' > README.md
git add -A && git commit -qm 'seed' && git push -q origin main
make_clone B
# B's clone happened after seed, so it already has the seed files; overwrite
# its scheduler/core stubs are in place from make_clone.

run() { # run <clone> — execute the scheduler script in a clone
  ( cd "$T/$1" && bash scheduler/fetch-and-commit.sh ) >/dev/null 2>&1 || true
}
in_rebase() { # in_rebase <clone>
  [ -d "$T/$1/.git/rebase-merge" ] || [ -d "$T/$1/.git/rebase-apply" ]
}
history_count() { node -e "console.log(JSON.parse(require('fs').readFileSync('$T/$1/data/history.json','utf8')).length)"; }

# ── Scenario 1: happy path on both machines ────────────────────────────────
echo "Scenario 1: happy path"
run A
assert "A pushed its snapshot" git -C "$T/A" diff --quiet origin/main main
sleep 1
run B
assert "B pulled A's snapshot then pushed its own" \
  git -C "$T/B" diff --quiet origin/main main
[ "$(history_count B)" = "2" ] && ok "B history has both samples (2)" || fail "B history expected 2 entries, got $(history_count B)"

# ── Scenario 2: concurrent snapshots → auto-resolve, union history ─────────
echo "Scenario 2: concurrent snapshots"
( cd "$T/A" && git pull -q --rebase )   # both start in sync
( cd "$T/B" && git pull -q --rebase )
sleep 1
run A                                    # A snapshots and pushes
sleep 1
( cd "$T/B" && node core/dist/cli.js && git add data && git commit -qm 'local unpushed snapshot' )
BEFORE_B="$(history_count B)"
run B                                    # B must rebase over A's push and resolve
assert "B is not left mid-rebase" bash -c "! { [ -d '$T/B/.git/rebase-merge' ] || [ -d '$T/B/.git/rebase-apply' ]; }"
assert "B pushed after resolving" git -C "$T/B" diff --quiet origin/main main
AFTER_B="$(history_count B)"
# B had BEFORE_B entries incl. its local one; must have gained A's entry + its own new fetch
if [ "$AFTER_B" -ge $((BEFORE_B + 2)) ]; then
  ok "history union kept samples from BOTH machines ($BEFORE_B → $AFTER_B)"
else
  fail "history lost samples: $BEFORE_B → $AFTER_B (expected ≥ $((BEFORE_B + 2)))"
fi
assert "merged history.json is valid JSON" node -e "JSON.parse(require('fs').readFileSync('$T/B/data/history.json','utf8'))"

# ── Scenario 3: wedged rebase from a crashed previous run → recovered ──────
echo "Scenario 3: wedged-rebase recovery"
( cd "$T/A" && git pull -q --rebase ); sleep 1
run A                                    # A pushes a new snapshot
sleep 1
( cd "$T/B" && node core/dist/cli.js && git add data && git commit -qm 'wedge bait' \
  && git pull --rebase >/dev/null 2>&1 || true )  # old behavior: conflict wedges it
in_rebase B && ok "fixture: B is wedged mid-rebase (simulating old bug)" || fail "fixture: could not wedge B"
run B                                    # new script must recover and complete
assert "B recovered from the wedge" bash -c "! { [ -d '$T/B/.git/rebase-merge' ] || [ -d '$T/B/.git/rebase-apply' ]; }"
assert "B pushed after recovery" git -C "$T/B" diff --quiet origin/main main
grep -q "recovered: aborted stale rebase" "$T/B/scheduler/fetch.log" \
  && ok "recovery was logged" || fail "recovery log line missing"

# ── Scenario 4: non-data conflict → abort safely, never wedge ──────────────
echo "Scenario 4: non-data conflict safety"
( cd "$T/A" && git pull -q --rebase && echo 'A change' > README.md && git add README.md && git commit -qm 'A README' && git push -q )
( cd "$T/B" && git pull --rebase >/dev/null 2>&1 || true )
( cd "$T/B" && git rebase --abort >/dev/null 2>&1 || true; git pull -q --rebase 2>/dev/null || true )
( cd "$T/B" && echo 'B change' > README.md && git add README.md && git commit -qm 'B README' )
( cd "$T/A" && echo 'A change 2' > README.md && git add README.md && git commit -qm 'A README 2' && git push -q )
run B
assert "B is not wedged after non-data conflict" bash -c "! { [ -d '$T/B/.git/rebase-merge' ] || [ -d '$T/B/.git/rebase-apply' ]; }"
grep -q "conflict in non-data file" "$T/B/scheduler/fetch.log" \
  && ok "non-data conflict was detected and skipped" || fail "non-data conflict log line missing"
assert "B's local README commit survived (not auto-destroyed)" \
  bash -c "git -C '$T/B' log --oneline | grep -q 'B README'"

# ── Result ──────────────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
