#!/usr/bin/env bash
# claude-pulse — installer.
# Builds the fetcher, takes a first usage reading (proving your Claude Code token
# resolves), then prints the exact statusline + scheduler steps with YOUR path
# filled in. It does NOT edit your settings for you — the steps are copy-paste.
#
#   git clone https://github.com/<you>/claude-pulse && cd claude-pulse
#   bash install.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "── claude-pulse install ──────────────────────────────────"

# 1. Build the core fetcher.
echo "▸ building core fetcher…"
( cd "$ROOT/core" && npm install --silent && npm run build >/dev/null )
echo "  ✓ built"

# 2. First reading — this reads YOUR ~/.claude/.credentials.json (read-only).
echo "▸ taking a first usage reading…"
if node "$ROOT/core/dist/cli.js" fetch; then
  echo "  ✓ data/usage.json written"
else
  echo "  ✗ fetch failed — is Claude Code logged in? (~/.claude/.credentials.json must exist)"
fi

OS="$(uname -s)"
case "$OS" in
  Linux)  SCHED="bash \"$ROOT/scheduler/install-linux.sh\"" ;;
  Darwin) SCHED="bash \"$ROOT/scheduler/install-macos.sh\"" ;;
  *)      SCHED="powershell -File \"$ROOT/scheduler/install-windows.ps1\"" ;;
esac

cat <<EOF

── next steps (copy-paste) ───────────────────────────────────

1) STATUSLINE — add to ~/.claude/settings.json:

   "statusLine": {
     "type": "command",
     "command": "bash $ROOT/statusline/statusline.sh"
   }

   (Optional, for the exact statusline colors) copy the bundled ccstatusline config:
     mkdir -p ~/.config/ccstatusline
     cp "$ROOT/statusline/ccstatusline.settings.json" ~/.config/ccstatusline/settings.json

2) AUTO-REFRESH — install the 15-minute scheduler:
     $SCHED

3) DASHBOARD (optional) — to publish your own live dashboard, point this repo's
   remote at YOUR GitHub repo and enable Pages (GitHub Actions). See README → "Your own dashboard".

Your token never leaves your machine; the published snapshots are just percentages.
──────────────────────────────────────────────────────────────
EOF
