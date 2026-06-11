# claude-pulse — Progress

## 2026-06-11

### Statusline palette tweak
Model segment darkened to a richer green (`46;125;50`, Material green 800) for more presence; the branch segment took over the previous model green (`67;160;71`) instead of blue. Both the palette comment and the sed remap in `statusline/statusline.sh` updated together. Repo made public so the team can clone and self-install (each user's own token resolves at runtime — only the code is shared).

### Built: live Claude usage HUD (v0 — shipped)
A cross-platform tool that surfaces your Claude subscription usage in three places, built by an agentille `feature-team` (5 teammates).

**What it does.** Reads your Claude Code OAuth token (read-only), calls the same usage endpoint the `/usage` screen uses (`GET https://api.anthropic.com/api/oauth/usage`), and normalizes it into a `data/usage.json` snapshot. Three surfaces consume that snapshot:

1. **Core fetcher + CLI** (`core/`) — Node/TypeScript. Cross-platform token resolution (`~/.claude/.credentials.json` → Windows `%USERPROFILE%` → macOS Keychain fallback), 10s fetch timeout, sanitized error codes, atomic writes, append-and-cap `history.json`. 36 unit tests.
2. **Statusline segment** (`statusline/`) — a script for your Claude Code `statusLine.command` (sits alongside ccstatusline). Prints `◔ 5h 25%  ◑ wk 26% ↻2d  ⚡€0/17k` with severity color (green <60 / amber <85 / red ≥85) and a red `!` when data is stale or errored.
3. **GitHub Pages dashboard** (`dashboard/`) — React + Vite + Tailwind, live at https://hasuwini77.github.io/claude-pulse/. Tactical ops-console look: 270° tachometer gauges (5-hour + weekly), reset countdowns, per-model weekly (Sonnet/Opus), extra-usage credit meter, 7-day sparkline. Self-hosted fonts, WCAG 2.2 AA (axe 0 violations).

**Staying current.** Cross-platform schedulers (`scheduler/`): Task Scheduler (Windows `.ps1`), launchd (macOS), cron (Linux/WSL). Each fetches every ~15 min, then commits **only** `data/usage.json` + `data/history.json` and pushes — the GitHub Actions workflow rebuilds + redeploys Pages.

**The honest bit.** Claude has no "daily" limit. The real windows are a rolling **5-hour** window and a **7-day weekly** window — the tool labels them exactly that, never "daily".

### Security
- OAuth token is read-only, in-memory only for the single request — never written, logged, bundled, or committed. Verified by a full git-object scan across all refs (0 secret hits) + a one-shot security review (SECURITY PASS).
- Published snapshots carry only utilization %, reset timestamps, and credit numbers — no token, no PII, no account id, no filesystem paths.
- `.gitignore` excludes `.credentials.json`, `.env*`, `*.token`. The scheduler stages an explicit two-file allowlist. The deploy workflow scans the whole `dist/` for secrets and hard-fails on a missing bundle.

### Review outcome
- Code + security gate: PASS on all three pieces.
- Design gate: PASS, 7.8/10 (axe 0 violations, full WCAG 2.2 AA, zero AI-design-tells — "a credible tactical ops-console"). Took 4 gauge revs to land the dial legibly.

### Setup
- Install the fetcher: `cd core && npm install && npm run build` → `node dist/cli.js fetch`.
- Wire the statusline: see `statusline/README.md`.
- Run the dashboard locally: `cd dashboard && npm install && npm run build && npm run preview`.
- Enable the scheduler: `scheduler/install-<os>.{sh,ps1}`.

### Known follow-ups (non-blocking, P2/P3)
- `core/src/write.ts`: the `os.tmpdir()` temp-file move loses atomic-rename guarantees on tmpfs `/tmp` (EXDEV copy fallback). Rare torn local read, absorbed by the statusline degraded path. Cleaner fix: temp file in `data/` + `data/*.tmp` gitignored, paired with the scheduler's explicit-file allowlist.
- Statusline prints the `currency` string raw — a crafted `usage.json` in another repo could inject ANSI escapes. Whitelist the currency symbol or drop the cwd fallback.
- `token.ts`: on a keychain JSON-parse failure the raw blob is sent as the Bearer token (endpoint is hardcoded TLS Anthropic, so it never leaks) — a length/prefix sanity check would be cheap.
- `scheduler/install-linux.sh`: unquoted `$REPO_ROOT`/`$HOME` in the cron line breaks on paths with spaces (functional, not security).
- Deploy workflow uses Node 20 GitHub Actions (`checkout@v4`, `setup-node@v4`, `upload-artifact@v4`) — deprecated June 2026; bump action versions.
