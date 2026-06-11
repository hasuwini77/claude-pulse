#!/usr/bin/env bash
# claude-pulse — composed Claude Code statusline.
#
# Runs ccstatusline, recolors its segments to the claude-pulse palette so the
# whole line is one cohesive, calm, accessible scheme, then appends the usage
# segment. Wire into ~/.claude/settings.json:
#   "statusLine": { "type": "command",
#     "command": "bash /home/hasuwini77/dev/claude-pulse/statusline/statusline.sh" }
#
# Palette (truecolor, tuned for dark terminals):
#   primary text  221;227;236 (#DDE3EC)   accent purple 185;141;224 (#B98DE0)
#   muted slate   139;150;172 (#8B96AC)    severity lives in the usage segment
#
# ccstatusline emits the Tango ANSI for its named colors; we remap each to the
# palette (model→primary, ctx/worktree→muted, branch→accent). If ccstatusline's
# config colors change, update or drop the matching sed line — it degrades
# gracefully (an unmapped color just renders as ccstatusline's default).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_JSON="$(cat)"   # Claude Code pipes the session JSON on stdin — consume once.

ccs="$(printf '%s' "$SESSION_JSON" | npx -y ccstatusline@latest 2>/dev/null | sed -E \
  -e 's/38;2;138;226;52/38;2;221;227;236/g'  \
  -e 's/38;2;252;233;79/38;2;139;150;172/g'  \
  -e 's/38;2;173;127;168/38;2;185;141;224/g' \
  -e 's/38;2;6;152;154/38;2;139;150;172/g')"

usage="$(node "$SCRIPT_DIR/claude-pulse-statusline.js" 2>/dev/null)"

printf '%s  %s\n' "$ccs" "$usage"
