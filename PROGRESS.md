# claude-pulse — Progress

## 2026-09-11

### Fix: statusline self-heals a stalled launchd fetch job (issue #9)
The macOS `com.claude-pulse.fetch` LaunchAgent (`StartInterval=900`) silently
stopped firing for 12h40m while the Mac stayed awake the whole time — no
error anywhere, `launchctl print` reported `last exit code = 0`. The
statusline kept showing a 12h-old snapshot with no way to know the scheduler
itself had gone quiet. A manual `launchctl kickstart gui/$UID/com.claude-pulse.fetch`
ran it instantly, so the timer wasn't broken — it had just stopped being
told to fire.

- **Fix.** `statusline/claude-pulse-statusline.js` now calls a new
  `kickFetcherIfStale(fetchedAt)` at the end of `main()`, on every render
  path (including the degraded no-data branch). On macOS only, if the
  snapshot is older than 20 minutes (or `fetched_at` is missing/unparseable)
  and `~/Library/LaunchAgents/com.claude-pulse.fetch.plist` is installed, it
  runs `launchctl kickstart gui/$UID/com.claude-pulse.fetch` — deliberately
  without `-k`, so a job already mid-run is never restarted. A stamp file in
  `$TMPDIR` throttles this to at most one kick per 15 minutes across every
  open session, and `os`/`child_process` are only required lazily on the
  stale path so the normal fresh-render hot path pays nothing extra.
- **Consumer boundary preserved.** Per `CONTRACT.md` the scheduler stays the
  only producer of usage data; the statusline still never fetches or touches
  the network itself — it only asks launchd to run the job sooner. The
  contract now says so explicitly.
- **Docs correction.** `statusline/README.md` claimed the segment "falls
  back to `--`... when fetched more than 30 minutes ago" — untrue; stale
  data keeps showing the last known values with a red `!`, and `--` only
  appears when `usage.json` itself is missing or unreadable. Fixed, and
  added a Self-heal section. `scheduler/README.md` gained a troubleshooting
  note for a stalled `StartInterval` job (`launchctl print ... | grep 'runs
  =\|last exit'` to check, `launchctl kickstart` to recover manually).
- **Measured.** `statusline/test-self-heal.sh` covers all 6 cases (stale
  kicks once, cooldown holds on an immediate second stale render, a fresh
  snapshot never kicks, no kick when the plist isn't installed, the
  degraded/missing-`usage.json` path still kicks once, `-k` never appears in
  any invocation) — 10/10 assertions PASS. 20 fresh renders in a temp
  sandbox timed before and after the change to confirm the hot path is
  unaffected (numbers in the PR).

## 2026-09-09

### Perf: global ccstatusline lookup now covers Homebrew / /usr/local
PR #6 made the statusline call the globally installed `ccstatusline` dist directly, but only searched `~/.nvm/versions/node/*`. The Mac runs Homebrew node (no nvm), so every render still fell through to `npx ccstatusline@2.2.22` — 1.2s wall / 1.15s user CPU per paint, multiplied by every open Claude session. Added `/opt/homebrew/lib/node_modules` and `/usr/local/lib/node_modules` to the glob (no `npm root -g` call — that is itself a node process). Measured: full statusline render 0.37s wall / 0.30s user after; direct node 0.29s vs npx 1.21s.


## 2026-08-31

### Fix: WezTerm "Font problem" popup — worktree glyph in no installed font
Launching WezTerm raised a modal: *"No fonts contain glyphs for these codepoints: \u{16830}. Placeholder glyphs are being displayed instead."*

- **Cause.** `ccstatusline` 2.2.22 prints U+16830 (Bamum Supplement) as the default symbol for its `git-worktree` widget, so the statusline emitted `⎇ main | 𖠰 main`. Nothing installed on the machine covers that block — not Fira Code, not JetBrains Mono NL Nerd Font, not Segoe UI Symbol or Segoe UI Emoji — so it rendered as tofu and WezTerm popped its missing-glyph warning on every launch.
- **Fix.** `ccstatusline` supports a per-item `character` override (`formatSymbolPrefix` reads `item.character` before falling back to the widget default), so `statusline/ccstatusline.settings.json` now sets `"character": "⌂"` on the `git-worktree` item. `⌂` (U+2302 HOUSE) was picked by checking cmap coverage across every installed font: Fira Code, JetBrains Mono NL Nerd Font and Segoe UI Symbol all have it, and Fira Code is the primary font in both WezTerm and Windows Terminal, so it resolves in the primary font with no fallback hop.
- No terminal config was touched — silencing WezTerm's `warn_about_missing_glyphs` would have hidden the symptom while leaving a tofu box sitting in the statusline.

The same `character` key has to be mirrored into `~/.config/ccstatusline/settings.json`, which is the file ccstatusline actually reads; the repo copy is the tracked reference.

## 2026-06-24

### Fix: statusline froze off-main + blanked on new tabs
Two independent bugs surfaced together (statusline showing a stale weekly 18% when the real figure was 44%, and disappearing entirely on freshly opened terminal tabs).

- **Frozen usage off-main.** `scheduler/fetch-and-commit.sh` aborted the *entire* run — including the local data fetch — whenever the repo wasn't on `main`. Sitting on a feature branch (`feat/statusline-effort`) for ~26h meant `data/usage.json` never refreshed, so the statusline read 26-hour-old numbers. Fix: the branch check no longer aborts; the fetch refreshes `data/usage.json` on every run regardless of branch (the statusline reads that file directly), and only the remote sync + commit + push stay gated to `main` so snapshots still never land on a feature branch.
- **Blank statusline on new tabs.** `statusline/statusline.sh` ran under `set -euo pipefail` and invoked `npx -y ccstatusline@latest`. The `@latest` tag forces an npm-registry round-trip on every render; on a cold or offline tab that hangs/fails, and `set -e` then aborted the script before it printed anything. Fix: dropped `set -e`/`pipefail` (each segment degrades independently and the line always prints) and pinned `ccstatusline@2.2.22` so it resolves straight from the npx cache — fast and offline-safe.

Both changes are in the shared `.sh` scripts, so they cover Linux/WSL and macOS; no GNU-only or `timeout`-dependent constructs were used.

## 2026-06-23

### Statusline: thinking-effort segment
Added a live reasoning-effort indicator to the statusline. It reads `effort.level` from the session JSON Claude Code pipes to `statusline/statusline.sh` (values `low`/`medium`/`high`/`xhigh`/`max`; the field is absent on models that don't support reasoning effort) and appends `Thinking <Level>` in mauve purple (`#cba6f7`, in-palette) to the end of line 1, right after the Ctx Used segment. Tracks mid-session `/effort` changes and degrades cleanly (segment omitted) when no effort level is reported.

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
