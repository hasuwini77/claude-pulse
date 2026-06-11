# claude-pulse scheduler

Background schedulers that run the core fetcher every ~15 minutes and commit
`data/` to the repo so the GitHub Pages dashboard stays fresh.

**Only `data/` is ever staged** — no secrets, no credentials, no full-tree
commits.

---

## How it works

```
[scheduler timer]
  → runs fetch-and-commit.sh (shared core script)
    → node core/dist/cli.js fetch     (writes data/usage.json + data/history.json)
    → git add data/                   (ONLY data/ — never secrets)
    → git commit (if changed)
    → git push
  → GitHub receives push
    → Actions workflow builds Vite app
    → deploys dist/ to GitHub Pages
```

---

## Prerequisites

- `core/dist/cli.js` built: run `npm run build` inside `core/`.
- Git remote set up with push access (SSH key or HTTPS token in credential
  helper).
- Node ≥18 and Git in PATH (schedulers try to resolve the full paths
  automatically).

---

## Platform install

### Linux / WSL

```bash
bash scheduler/install-linux.sh
```

Adds a `*/15 * * * *` crontab entry under the current user. Logs to
`scheduler/cron.log`.

To verify it's installed:
```bash
crontab -l | grep claude-pulse
```

To remove:
```bash
crontab -l | grep -v '# claude-pulse-fetch' | crontab -
```

---

### macOS

```bash
bash scheduler/install-macos.sh
```

Creates `~/Library/LaunchAgents/com.claude-pulse.fetch.plist` and loads it.
Runs every 15 minutes and at login. Logs to `scheduler/launchd-stdout.log` and
`scheduler/launchd-stderr.log`.

To remove:
```bash
launchctl unload ~/Library/LaunchAgents/com.claude-pulse.fetch.plist
rm ~/Library/LaunchAgents/com.claude-pulse.fetch.plist
```

---

### Windows

Open **PowerShell** (no Administrator required for per-user tasks):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scheduler\install-windows.ps1
```

Registers a Scheduled Task `claude-pulse-fetch` under the current user,
running every 15 minutes.

To remove:
```powershell
Unregister-ScheduledTask -TaskName 'claude-pulse-fetch' -Confirm:$false
```

---

## Manual run

```bash
bash scheduler/fetch-and-commit.sh
```

---

## Logs

| File                          | Written by        |
|-------------------------------|-------------------|
| `scheduler/fetch.log`         | fetch-and-commit.sh (all platforms) |
| `scheduler/cron.log`          | Linux cron entry  |
| `scheduler/launchd-stdout.log`| macOS launchd     |
| `scheduler/launchd-stderr.log`| macOS launchd     |

Log files are auto-rotated at 500 lines. They are **gitignored** — never
committed.
