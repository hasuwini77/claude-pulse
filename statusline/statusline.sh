#!/usr/bin/env bash
# claude-pulse — composed Claude Code statusline.
#
# Runs ccstatusline, recolors its segments to the claude-pulse palette so the
# whole line is one cohesive, calm, accessible scheme, then appends the usage
# segment. Wire into ~/.claude/settings.json:
#   "statusLine": { "type": "command",
#     "command": "bash /home/hasuwini77/dev/claude-pulse/statusline/statusline.sh" }
#
# Palette — Catppuccin Mocha (truecolor): colorful but tonally unified.
#   model → blue 89;180;250    ctx → sky 137;220;235
#   branch → mauve 203;166;247  worktree → teal 148;226;213
#
# ccstatusline emits the Tango ANSI for its named colors; we remap each to the
# palette. If ccstatusline's config colors change, update or drop the matching
# sed line — it degrades gracefully (an unmapped color renders as the default).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_JSON="$(cat)"   # Claude Code pipes the session JSON on stdin — consume once.

ccs="$(printf '%s' "$SESSION_JSON" | npx -y ccstatusline@latest 2>/dev/null | sed -E \
  -e 's/38;2;138;226;52/38;2;89;180;250/g'   \
  -e 's/38;2;252;233;79/38;2;137;220;235/g'  \
  -e 's/38;2;173;127;168/38;2;203;166;247/g' \
  -e 's/38;2;6;152;154/38;2;148;226;213/g')"

usage="$(node "$SCRIPT_DIR/claude-pulse-statusline.js" 2>/dev/null)"

printf '%s  %s\n' "$ccs" "$usage"
