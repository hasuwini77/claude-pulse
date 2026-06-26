/**
 * OAuth access-token refresh.
 *
 * Claude Code's access token is short-lived (hours). When it has expired — or
 * is within a small buffer of doing so — exchange the stored refresh token for
 * a fresh access token at the OAuth token endpoint, then persist the rotated
 * credentials back to their source so Claude Code AND the next fetch stay in
 * sync. Without this, a long idle gap (Claude Code not running to refresh)
 * leaves the cached token expired and every usage fetch 401s, freezing the
 * statusline on its last snapshot.
 *
 * Design: refresh failures degrade to the cached token (== prior behavior), so
 * a changed endpoint can never regress below today — it only ever improves
 * freshness. Write-back happens ONLY on a fully validated 200 response.
 *
 * SECURITY: tokens are never logged; only sanitized status lines go to stderr.
 */

import {
  resolveCredentialBundle,
  writeCredentialBundle,
  type OAuthCreds,
} from "./token.js";

// Claude Code's public OAuth client id (PKCE flow).
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
// console.anthropic.com is the original host; platform.claude.com is the
// post-rebrand mirror. Try the original first, fall back to the mirror.
const TOKEN_URLS = [
  "https://console.anthropic.com/v1/oauth/token",
  "https://platform.claude.com/v1/oauth/token",
];
const REFRESH_TIMEOUT_MS = 10_000;
// Refresh slightly ahead of the hard expiry to avoid racing the boundary.
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

interface RefreshResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

function tokenIsFresh(oauth: OAuthCreds): boolean {
  // Unknown expiry → treat as needing refresh (safer than assuming valid).
  if (typeof oauth.expiresAt !== "number") return false;
  return Date.now() < oauth.expiresAt - EXPIRY_BUFFER_MS;
}

/** POST the refresh grant. Returns the new fields, or null on any failure. */
async function requestRefresh(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  for (const url of TOKEN_URLS) {
    let host = url;
    try {
      host = new URL(url).host;
    } catch {
      /* keep full url for the message */
    }
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
        }),
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
      });

      if (!resp.ok) {
        // A 4xx here (e.g. invalid_grant) means NOTHING was issued — the
        // refresh token was not consumed, so trying the mirror is safe.
        process.stderr.write(
          `claude-pulse: token refresh HTTP ${resp.status} from ${host}\n`
        );
        continue;
      }

      const data = (await resp.json()) as RefreshResponse;
      if (
        typeof data.access_token === "string" &&
        data.access_token.length > 0 &&
        typeof data.refresh_token === "string" &&
        data.refresh_token.length > 0 &&
        typeof data.expires_in === "number" &&
        data.expires_in > 0
      ) {
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
        };
      }

      // 200 with a malformed body won't differ across hosts — stop here.
      process.stderr.write(
        "claude-pulse: token refresh returned an incomplete response\n"
      );
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`claude-pulse: token refresh error (${host}): ${msg}\n`);
      // network/timeout — try the next host
    }
  }
  return null;
}

/**
 * Refresh the stored credentials and persist the rotated set. Returns the new
 * access token, or null if refresh was not possible (caller falls back to the
 * cached token).
 */
export async function refreshAndPersist(): Promise<string | null> {
  const bundle = resolveCredentialBundle();
  if (
    !bundle ||
    typeof bundle.oauth.refreshToken !== "string" ||
    bundle.oauth.refreshToken.length === 0
  ) {
    return null;
  }

  const next = await requestRefresh(bundle.oauth.refreshToken);
  if (!next) return null;

  // Clone, replace only the three rotating fields, keep everything else.
  const nextOauth: OAuthCreds = {
    ...bundle.oauth,
    accessToken: next.accessToken,
    refreshToken: next.refreshToken,
    expiresAt: next.expiresAt,
  };
  const nextRaw = { ...bundle.raw, claudeAiOauth: nextOauth };

  try {
    writeCredentialBundle(bundle.source, nextRaw);
  } catch (err) {
    // The new token is valid for THIS run, but the store still holds the old
    // (now-rotated) refresh token — surface loudly so it's noticed.
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `claude-pulse: WARN failed to persist refreshed credentials: ${msg}\n`
    );
  }

  return next.accessToken;
}

/**
 * Return a valid access token: the cached one if still fresh, otherwise a
 * refreshed one. Falls back to the cached token if refresh fails. Throws only
 * when no credentials exist at all.
 */
export async function getFreshAccessToken(): Promise<string> {
  const bundle = resolveCredentialBundle();
  if (!bundle) {
    throw new Error(
      "Cannot resolve Claude OAuth credentials. Make sure Claude Code is installed and you are signed in."
    );
  }

  if (tokenIsFresh(bundle.oauth)) {
    return bundle.oauth.accessToken as string;
  }

  const refreshed = await refreshAndPersist();
  if (refreshed) return refreshed;

  // Refresh failed — use whatever cached token exists. It may be expired, in
  // which case the usage fetch 401s and the statusline shows its stale marker:
  // strictly no worse than the pre-refresh behavior.
  if (
    typeof bundle.oauth.accessToken === "string" &&
    bundle.oauth.accessToken.length > 0
  ) {
    return bundle.oauth.accessToken;
  }
  throw new Error("No usable Claude OAuth access token after refresh attempt.");
}
