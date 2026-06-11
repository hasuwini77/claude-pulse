# claude-pulse statusline

Prints a compact, ANSI-colored Claude usage line to stdout:

```
◔ 5h 25%  ◑ wk 26% ↻1d 8h  ⚡€0/17k
```

- **◔ 5h** — rolling 5-hour window utilization
- **◑ wk** — rolling 7-day weekly utilization with reset countdown
- **⚡** — extra-usage credits used / monthly cap

Color thresholds: green < 60 · amber 60–84 · red ≥ 85.  
Falls back to `◔ 5h --  ◑ wk --  ⚡ --` (dimmed) when `data/usage.json` is
missing or was fetched more than 30 minutes ago.

## Prerequisites

1. **Node.js ≥ 18** installed and on your PATH.
2. The **core fetcher** (`claude-pulse fetch`) running on a schedule (every ~15 min)
   so `data/usage.json` stays fresh. See the `scheduler/` README.

## Wiring into Claude Code `statusLine.command`

Open (or create) `~/.claude/settings.json` and add (or extend)
`statusLine.command`. The segment prints a single line — wrap it in
`$()` and concatenate it with any other segments you already have.

### You already run `ccstatusline`

Append the claude-pulse segment after it on the same line, separated by spaces:

```json
{
  "statusLine": {
    "command": "echo \"$(ccstatusline)  $(node /absolute/path/to/claude-pulse/statusline/claude-pulse-statusline.js)\""
  }
}
```

Replace `/absolute/path/to/claude-pulse` with the real path, e.g.:
`/home/you/dev/claude-pulse`

### Starting fresh (no existing statusLine)

```json
{
  "statusLine": {
    "command": "node /home/you/dev/claude-pulse/statusline/claude-pulse-statusline.js"
  }
}
```

### Verify it works

```bash
node /home/you/dev/claude-pulse/statusline/claude-pulse-statusline.js
# → ◔ 5h 25%  ◑ wk 26% ↻1d 8h  ⚡€0/17k
```

If it shows `◔ 5h --`, the `data/usage.json` file is either missing or stale.
Run `node /home/you/dev/claude-pulse/core/dist/cli.js fetch` (or your installed
`claude-pulse fetch` binary) to refresh it.

## Scheduler (keep the data fresh)

See `scheduler/README.md` for cron / launchd / Scheduled Task installers that
run `claude-pulse fetch` every ~15 minutes and commit the snapshot to the repo.

## Output format reference

| Segment | Source field | Notes |
|---------|-------------|-------|
| `◔ 5h X%` | `five_hour.utilization` | 5-hour rolling window |
| `◑ wk X% ↻Nd` | `weekly.utilization` + `weekly.resets_at` | 7-day rolling window |
| `⚡€X/Yk` | `extra_usage.used_credits` / `monthly_limit` | Extra-usage credits (EUR by default) |
