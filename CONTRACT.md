# Data Contract — `claude-pulse`

All three surfaces (core fetcher, statusline, dashboard) bind to this. The fetcher is the
only producer; statusline + dashboard are read-only consumers. Never read the raw Anthropic
endpoint anywhere but the fetcher.

## Source endpoint (fetcher only — read-only)
`GET https://api.anthropic.com/api/oauth/usage`
Headers: `Authorization: Bearer <token>`, `anthropic-beta: oauth-2025-04-20`, `Content-Type: application/json`

Token resolution, in order: `~/.claude/.credentials.json` → `claudeAiOauth.accessToken`
(Windows: `%USERPROFILE%\.claude\.credentials.json`); macOS Keychain fallback
(`security find-generic-password -s "Claude Code-credentials" -w`). Read-only; never refresh/rewrite.

## `data/usage.json` (current snapshot — written by fetcher)
```json
{
  "fetched_at": "ISO8601 UTC",
  "five_hour":  { "utilization": 25.0, "resets_at": "ISO8601 UTC" },
  "weekly":     { "utilization": 26.0, "resets_at": "ISO8601 UTC" },
  "weekly_sonnet": { "utilization": 23.0, "resets_at": "ISO8601 UTC" },
  "weekly_opus":   { "utilization": null, "resets_at": null },
  "extra_usage": { "enabled": true, "monthly_limit": 17000, "used_credits": 0.0, "currency": "EUR" },
  "error": null
}
```
Nullable: `weekly_sonnet`, `weekly_opus` (and their inner fields). On fetch failure, set
`error` to a string and preserve the last good window values if available.

## `data/history.json` (append-only, capped to last 7 days)
```json
[ { "t": "ISO8601 UTC", "five_hour": 25.0, "weekly": 26.0 } ]
```

## Shared severity thresholds
`ok` if util `< 60`, `warn` if `60 ≤ util < 85`, `crit` if `util ≥ 85`.

## Terminology (honest)
Claude has NO daily limit. The windows are a rolling **5-hour** window and a **7-day weekly**
window. Label them "5-hour" and "Weekly" — never "daily".

## Security
The OAuth token is a secret. It must never appear in any committed file, the dashboard
bundle, logs, or these JSON snapshots. `usage.json`/`history.json` carry only utilization %,
reset times, and credit numbers — safe to publish.
