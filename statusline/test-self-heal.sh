#!/usr/bin/env bash
# claude-pulse — test for the statusline's stale-data self-heal (issue #9).
# Builds a sandboxed HOME/TMPDIR/PATH, stubs `launchctl`, and asserts that
# claude-pulse-statusline.js:
#   1. kicks launchd exactly once on a stale render (and still prints the
#      normal segment with the stale `!`)
#   2. does NOT kick again immediately after (cooldown)
#   3. does NOT kick on a fresh render, even with the cooldown cleared
#   4. does NOT kick when the fetch LaunchAgent's plist is not installed
#   5. DOES kick once on the degraded (missing usage.json) path
#   6. never passes `-k` to launchctl (a kick must never restart a running job)
#
# Run: bash statusline/test-self-heal.sh

set -uo pipefail

if [ "$(uname)" != "Darwin" ]; then
  echo "SKIP (macOS only)"
  exit 0
fi

STATUSLINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/claude-pulse-selfheal.XXXXXX")"
trap 'rm -rf "$T"' EXIT

PASS=0; FAIL=0
ok()   { PASS=$((PASS + 1)); echo "  PASS: $*"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $*"; }

# ── Sandbox ──────────────────────────────────────────────────────────────
mkdir -p "$T/repo/statusline" "$T/repo/data"
mkdir -p "$T/home/Library/LaunchAgents"
mkdir -p "$T/bin"
mkdir -p "$T/t" # private TMPDIR

cp "$STATUSLINE_DIR/claude-pulse-statusline.js" "$T/repo/statusline/claude-pulse-statusline.js"

PLIST="$T/home/Library/LaunchAgents/com.claude-pulse.fetch.plist"
: > "$PLIST"

LOG="$T/launchctl.log"
: > "$LOG"
cat > "$T/bin/launchctl" <<EOF
#!/usr/bin/env bash
echo "\$@" >> "$LOG"
exit 0
EOF
chmod +x "$T/bin/launchctl"

STAMP="$T/t/claude-pulse-kick.stamp"

run_statusline() { # run_statusline — invokes the segment in the sandbox, prints stdout
  ( cd "$T/repo/statusline" && \
    HOME="$T/home" TMPDIR="$T/t" PATH="$T/bin:$PATH" \
    node claude-pulse-statusline.js )
}

write_snapshot() { # write_snapshot <fetched_at-iso>
  cat > "$T/repo/data/usage.json" <<JSON
{
  "fetched_at": "$1",
  "five_hour": { "utilization": 21, "resets_at": null },
  "weekly": { "utilization": 84, "resets_at": null },
  "extra_usage": { "enabled": false }
}
JSON
}

log_lines() { wc -l < "$LOG" | tr -d ' '; }

wait_for_count() { # wait_for_count <expected> — poll up to ~2s
  local expected="$1" i=0
  while [ "$i" -lt 20 ]; do
    [ "$(log_lines)" = "$expected" ] && return 0
    sleep 0.1
    i=$((i + 1))
  done
  return 1
}

UID_NOW="$(id -u)"
KICK_PATTERN="^kickstart gui/${UID_NOW}/com\.claude-pulse\.fetch\$"

# ── Case 1: stale snapshot → exactly one kick, normal segment still prints ─
echo "Case 1: stale snapshot kicks launchd once"
STALE_AT="$(node -e 'console.log(new Date(Date.now() - 60*60*1000).toISOString())')"
write_snapshot "$STALE_AT"
OUT="$(run_statusline)"
wait_for_count 1 && ok "exactly one kickstart line after a stale render" \
  || fail "expected 1 kickstart line, got $(log_lines)"
grep -qE "$KICK_PATTERN" "$LOG" && ok "kick line has the right shape" \
  || fail "kick line malformed: $(cat "$LOG")"
echo "$OUT" | grep -q "◔ 5h" && ok "stdout still prints the normal segment" \
  || fail "stdout missing ◔ 5h: $OUT"
echo "$OUT" | grep -q "!" && ok "stdout still flags the stale warning" \
  || fail "stdout missing stale ! marker: $OUT"

# ── Case 2: immediate second stale render → cooldown, still one line ──────
echo "Case 2: cooldown suppresses an immediate second kick"
run_statusline > /dev/null
sleep 1
[ "$(log_lines)" = "1" ] && ok "still exactly one kickstart line (cooldown held)" \
  || fail "cooldown did not hold: $(log_lines) lines"

# ── Case 3: stamp cleared + fresh snapshot → no new kick ───────────────────
echo "Case 3: fresh snapshot does not kick, even with cooldown cleared"
rm -f "$STAMP"
FRESH_AT="$(node -e 'console.log(new Date().toISOString())')"
write_snapshot "$FRESH_AT"
BEFORE="$(log_lines)"
run_statusline > /dev/null
sleep 1
[ "$(log_lines)" = "$BEFORE" ] && ok "no new kick for a fresh snapshot" \
  || fail "unexpected kick on fresh snapshot: $BEFORE -> $(log_lines)"

# ── Case 4: stamp cleared + stale + plist removed → no kick ────────────────
echo "Case 4: no LaunchAgent plist installed → no kick"
rm -f "$STAMP"
rm -f "$PLIST"
write_snapshot "$STALE_AT"
BEFORE="$(log_lines)"
run_statusline > /dev/null
sleep 1
[ "$(log_lines)" = "$BEFORE" ] && ok "no kick when the plist is missing" \
  || fail "kicked even though the plist is missing: $BEFORE -> $(log_lines)"

# ── Case 5: missing usage.json + plist present → one kick (degraded path) ──
echo "Case 5: degraded (no usage.json) path still kicks once"
: > "$PLIST"
rm -f "$STAMP"
rm -f "$T/repo/data/usage.json"
BEFORE="$(log_lines)"
OUT="$(run_statusline)"
EXPECTED=$((BEFORE + 1))
wait_for_count "$EXPECTED" && ok "one kick on the degraded no-data path" \
  || fail "expected $EXPECTED kickstart lines, got $(log_lines)"
echo "$OUT" | grep -q -- "--" && ok "degraded stdout still prints the -- fallback" \
  || fail "stdout missing -- fallback: $OUT"

# ── Case 6: -k never appears ────────────────────────────────────────────────
echo "Case 6: -k (restart) is never passed to launchctl"
grep -q -- "-k" "$LOG" && fail "found -k in launchctl log — must never restart a running job" \
  || ok "no -k in any launchctl invocation"

# ── Result ───────────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
