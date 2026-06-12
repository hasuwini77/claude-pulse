# claude-pulse

Live Claude subscription usage — everywhere. A cross-platform tool that reads your Claude
Code OAuth usage and surfaces it in three places:

- **CLI / fetcher** — reads your usage, writes a `data/usage.json` snapshot.
- **Statusline segment** — a compact `◔ 5h 25%  ◑ wk 26% ↻2d` line for your Claude Code statusline.
- **GitHub Pages dashboard** — a stylish live dashboard, auto-updated by a background scheduler.

> Claude has no "daily" limit. The real windows are a rolling **5-hour** window and a **7-day
> weekly** window — this tool shows both, plus the weekly reset countdown and extra-usage credits.

## Install it yourself (or share with others)

One command from a clone:

```bash
git clone https://github.com/<you>/claude-pulse && cd claude-pulse
bash install.sh
```

`install.sh` builds the fetcher, takes a first reading (proving your token resolves), then
**prints** the exact statusline + scheduler steps with your path filled in — it never edits
your config silently. The steps are:

1. **Statusline** — add to `~/.claude/settings.json`:
   ```json
   "statusLine": { "type": "command", "command": "bash /abs/path/to/claude-pulse/statusline/statusline.sh" }
   ```
   For the exact colors, also copy the bundled ccstatusline config:
   ```bash
   mkdir -p ~/.config/ccstatusline
   cp statusline/ccstatusline.settings.json ~/.config/ccstatusline/settings.json
   ```
2. **Auto-refresh** — `bash scheduler/install-linux.sh` (or `install-macos.sh` / `install-windows.ps1`).

### How sharing works — the important bits

- **Everyone uses their OWN token, automatically.** The fetcher reads each person's local
  `~/.claude/.credentials.json` at runtime. You **never** share a token — just share the *code*.
  Each install shows that user's own usage.
- **The statusline + CLI work for anyone** as-is once they run `install.sh` and wire the line above.
- **The dashboard needs each person's OWN GitHub repo** (see below) — because the scheduler
  commits snapshots to `origin` and publishes via that repo's Pages. If someone just clones
  *your* repo, their scheduler can't push to it.

### Your own dashboard

To publish your own live dashboard (not required for the statusline/CLI):

1. Create your own repo (or "Use this template" / fork), then point the clone at it:
   ```bash
   git remote set-url origin git@github.com:<you>/claude-pulse.git
   git push -u origin main
   ```
2. Enable Pages → **GitHub Actions** source:
   ```bash
   gh api -X POST repos/<you>/claude-pulse/pages -f build_type=workflow
   ```
3. The included `.github/workflows/deploy-pages.yml` builds + deploys on every push; the
   scheduler pushes a fresh `data/usage.json` every ~15 min, so your dashboard stays live at
   `https://<you>.github.io/claude-pulse/`.

## Running on multiple machines

Supported out of the box. Each machine runs its own scheduler against the same repo; the
fetch script is **self-healing**:

- It syncs with the remote *before* taking a snapshot, auto-resolves conflicts in `data/`
  (history entries from all machines are kept; the freshest snapshot wins), and retries a
  rejected push after re-syncing.
- A run interrupted mid-rebase (crash, shutdown) is recovered automatically on the next run.
- Conflicts in files **outside** `data/` are never auto-resolved — the script backs off,
  logs, and leaves your work intact for manual resolution.

## Troubleshooting

**macOS: scheduler exits 127, log says `can't open input file`** — the repo is in a
privacy-protected folder (`~/Documents`, `~/Desktop`, `~/Downloads`) which launchd can't
read. Grant your shell Full Disk Access: System Settings → Privacy & Security → Full Disk
Access → `+` → `Cmd+Shift+G` → `/bin/zsh` → toggle on. Or move the repo (e.g. `~/dev/`)
and re-run the installer. Verify with `launchctl list | grep claude-pulse` (second column
`0` = success).

**WSL: cron entry never fires** — the cron service isn't running by default in WSL
(`sudo service cron start`, or enable systemd in `/etc/wsl.conf`). Cron also only runs
while the WSL VM is alive — for a setup that survives reboots unattended, use the native
Windows scheduler: `scheduler/install-windows.ps1`.

**Scheduler stopped committing** — check `scheduler/fetch.log` (or `cron.log` /
`launchd-stderr.log`). The script logs every recovery and skip with the reason.

## Theme
Both the statusline and the dashboard use one **Catppuccin Mocha** palette so they read as a
single product. Each color is a single token — retune in `statusline/claude-pulse-statusline.js`,
the remap block in `statusline/statusline.sh`, or `dashboard/src/index.css`.

## Security
Your OAuth token is read **read-only** and never leaves your machine. It is never committed,
never bundled into the dashboard, never logged. The published snapshots contain only
utilization percentages, reset times, and credit numbers — safe to make public.
