#!/usr/bin/env bash
# claude-pulse — composed Claude Code statusline.
#
# Runs ccstatusline, recolors its segments to the claude-pulse palette so the
# whole line is one cohesive, calm, accessible scheme, then appends the usage
# segment. Wire into ~/.claude/settings.json:
#   "statusLine": { "type": "command",
#     "command": "bash /abs/path/to/claude-pulse/statusline/statusline.sh" }
#
# Palette — Catppuccin Mocha (truecolor): colorful but tonally unified.
#   model → green 46;125;50    ctx → yellow 249;226;175
#   branch → green 67;160;71    worktree → teal 148;226;213
#
# ccstatusline emits the Tango ANSI for its named colors; we remap each to the
# palette. If ccstatusline's config colors change, update or drop the matching
# sed line — it degrades gracefully (an unmapped color renders as the default).

# NB: deliberately NOT `set -e`/`pipefail`. The statusline must ALWAYS print a
# line — if any one segment (ccstatusline, node, the usage CLI) fails or is
# offline, we degrade that segment and still emit the rest. A hard-exit here
# blanks the entire statusline (which is exactly the "no statusline on new
# tabs" bug this guards against).
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_JSON="$(cat)"   # Claude Code pipes the session JSON on stdin — consume once.

# nvm installs `node`/`npx` as lazy shims that flood "_load_nvm: command not
# found" in the non-interactive shell Claude Code spawns for the statusline —
# bare `npx` then dies and emits NOTHING, blanking the model/Ctx/branch segment
# (the "context gone from statusline" bug). Resolve the real binaries from the
# newest nvm install and call those directly; also prepend the nvm bin to PATH
# so npx's `#!/usr/bin/env node` shebang resolves. Degrades to bare names if no
# nvm install is present.
NODE_BIN="node"; NPX_BIN="npx"
_nvm_bin="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
if [ -n "$_nvm_bin" ] && [ -x "$_nvm_bin/node" ]; then
  NODE_BIN="$_nvm_bin/node"
  [ -x "$_nvm_bin/npx" ] && NPX_BIN="$_nvm_bin/npx"
  PATH="$_nvm_bin:$PATH"
fi

# Pin the version: `@latest` forces an npm-registry round-trip on EVERY render,
# which hangs/fails on a cold or offline tab and blanks the line.
CCSTATUSLINE_VERSION="2.2.22"

# HOT PATH. `npx ccstatusline` re-bootstraps the whole npm CLI on EVERY render —
# ~800ms of CPU per statusline paint, times every open session. Measured at
# 26% CPU with four concurrent `npm exec` processes. Resolve the globally
# installed dist and hand it straight to node instead: one process, no npm.
# Install/refresh with:  npm i -g ccstatusline@2.2.22
# V8 compile cache (Node >=22). ccstatusline is a large bundled ESM; caching its
# compilation shaves module-load time off every render. Node invalidates the
# cache itself on version/content change, so it never needs clearing.
export NODE_COMPILE_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/claude-pulse-nodecache"

CCS_JS=""
for _c in "$HOME"/.nvm/versions/node/*/lib/node_modules/ccstatusline/dist/ccstatusline.js; do
  [ -f "$_c" ] && CCS_JS="$_c"
done

if [ -n "$CCS_JS" ]; then
  ccs_raw="$(printf '%s' "$SESSION_JSON" | "$NODE_BIN" "$CCS_JS" 2>/dev/null)"
else
  # Fallback only — slow. Means the global install is missing; reinstall it.
  ccs_raw="$(printf '%s' "$SESSION_JSON" | "$NPX_BIN" -y "ccstatusline@${CCSTATUSLINE_VERSION}" 2>/dev/null)"
fi

ccs="$(printf '%s' "$ccs_raw" | sed -E \
  -e 's/38;2;138;226;52/38;2;46;125;50/g'    \
  -e 's/38;2;252;233;79/38;2;249;226;175/g'  \
  -e 's/38;2;173;127;168/38;2;67;160;71/g'   \
  -e 's/38;2;6;152;154/38;2;148;226;213/g')"

usage="$("$NODE_BIN" "$SCRIPT_DIR/claude-pulse-statusline.js" 2>/dev/null)"

# Thinking-effort segment — read effort.level from the session JSON (absent on
# models without reasoning effort). Mauve (#cba6f7) — purple, in-palette.
# Appended to the END of line 1 (right after the Ctx Used segment).
# Parsed with bash parameter expansion, not a node one-liner: spawning node
# purely to pluck one string cost ~40ms of CPU on every render. Zero
# subprocesses here. Degrades to empty (segment omitted) on any shape mismatch.
effort=""
_ef="${SESSION_JSON#*\"effort\"}"
if [ "$_ef" != "$SESSION_JSON" ]; then
  _ef="${_ef#*\"level\"}"   # -> : "high", ...
  _ef="${_ef#*\"}"           # -> high", ...
  _ef="${_ef%%\"*}"          # -> high
  case "$_ef" in ([a-z]*) [ "${#_ef}" -le 12 ] && effort="$_ef" ;; esac
fi

if [ -n "$effort" ]; then
  MAUVE=$'\033[38;2;203;166;247m'; RST=$'\033[0m'
  Level="$(printf '%s' "${effort:0:1}" | tr '[:lower:]' '[:upper:]')${effort:1}"
  seg="  ${MAUVE}Thinking ${Level}${RST}"
  ccs="$(printf '%s' "$ccs" | awk -v e="$seg" 'NR==1{printf "%s%s\n",$0,e;next}{print}')"
fi

printf '%s  %s\n' "$ccs" "$usage"
