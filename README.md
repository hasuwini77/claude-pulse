# claude-pulse

Live Claude subscription usage — everywhere. A cross-platform tool that reads your Claude
Code OAuth usage and surfaces it in three places:

- **CLI / fetcher** — reads your usage, writes a `data/usage.json` snapshot.
- **Statusline segment** — a compact `◔ 5h 25%  ◑ wk 26% ↻2d` line for your Claude Code statusline.
- **GitHub Pages dashboard** — a stylish live dashboard, auto-updated by a background scheduler.

> Claude has no "daily" limit. The real windows are a rolling **5-hour** window and a **7-day
> weekly** window — this tool shows both, plus the weekly reset countdown and extra-usage credits.

## Status
Scaffolding committed. Implementation in progress (see `CONTRACT.md` for the data schema).

## Security
Your OAuth token is read **read-only** and never leaves your machine. It is never committed,
never bundled into the dashboard, never logged. The published snapshots contain only
utilization percentages, reset times, and credit numbers.

<!-- Setup / install / dashboard URL sections are filled in by the build. -->
