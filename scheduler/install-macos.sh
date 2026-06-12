#!/usr/bin/env bash
# claude-pulse — macOS launchd installer
# Installs a LaunchAgent plist that runs fetch-and-commit.sh every 15 min.
# Run once (no sudo needed — LaunchAgent runs as the current user):
#   bash scheduler/install-macos.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FETCH_SCRIPT="$REPO_ROOT/scheduler/fetch-and-commit.sh"
PLIST_ID="com.claude-pulse.fetch"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_ID.plist"
LOG_DIR="$REPO_ROOT/scheduler"

chmod +x "$FETCH_SCRIPT"

# Resolve the shell that has git/node in PATH
# Prefer zsh (macOS default), fall back to bash
SHELL_BIN="${SHELL:-/bin/zsh}"
# Export PATH explicitly so launchd (which starts with a minimal env) finds node+git
NODE_PATH="$(dirname "$(command -v node 2>/dev/null || echo /usr/local/bin/node)")"
GIT_PATH="$(dirname "$(command -v git)")"

cat > "$PLIST_PATH" <<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_ID}</string>

  <!-- The login shell wrapper picks up PATH; the script itself is bash
       (it uses BASH_SOURCE), so exec bash explicitly — zsh ignores the
       shebang when handed a script path. -->
  <key>ProgramArguments</key>
  <array>
    <string>${SHELL_BIN}</string>
    <string>-l</string>
    <string>-c</string>
    <string>exec bash "${FETCH_SCRIPT}"</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>

  <!-- Every 900 seconds = 15 minutes -->
  <key>StartInterval</key>
  <integer>900</integer>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/launchd-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/launchd-stderr.log</string>

  <!-- Make sure node and git are in PATH inside launchd -->
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${NODE_PATH}:${GIT_PATH}:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>
</dict>
</plist>
XML

# Load the agent (unload first if already loaded)
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

echo ""
echo "LaunchAgent installed: $PLIST_ID"
echo "  Plist  : $PLIST_PATH"
echo "  Script : $FETCH_SCRIPT"
echo "  Runs   : every 15 minutes (also at login)"
echo ""
echo "To uninstall:"
echo "  launchctl unload '$PLIST_PATH' && rm '$PLIST_PATH'"
