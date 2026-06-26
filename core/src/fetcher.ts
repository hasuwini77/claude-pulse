/**
 * Core fetcher: resolve token → GET usage endpoint → normalize → write data files.
 *
 * SECURITY: token is read once, used for the single HTTP request, then discarded.
 * It is NEVER logged, written to disk, or returned from this module.
 *
 * Error hygiene: short sanitized codes go into committed usage.json ("token-unresolved",
 * "network-error", "http-401", "http-NNN"). Full diagnostic messages go to stderr only.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appendHistory, type HistoryPoint } from "./history.js";
import { errorSnapshot, normalizeUsage, type RawUsageResponse, type UsageSnapshot } from "./normalize.js";
import { getFreshAccessToken, refreshAndPersist } from "./refresh.js";
import { atomicWriteJson } from "./write.js";

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const FETCH_TIMEOUT_MS = 10_000;

function usagePath(repoRoot: string): string {
  return resolve(repoRoot, "data", "usage.json");
}

function historyPath(repoRoot: string): string {
  return resolve(repoRoot, "data", "history.json");
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write short sanitized code to usage.json; full detail to stderr. */
function writeError(
  uPath: string,
  publicCode: string,
  detail: string,
  lastAttemptAt: string
): void {
  process.stderr.write(`claude-pulse: ${detail}\n`);
  const lastGood = readJsonFile<UsageSnapshot>(uPath);
  atomicWriteJson(uPath, errorSnapshot(publicCode, lastAttemptAt, lastGood));
}

export interface FetchResult {
  success: boolean;
  /** Short sanitized error code (safe for public repo). Present on failure. */
  errorCode?: string;
}

/**
 * Fetch Claude usage, normalize, and write data/usage.json + data/history.json.
 *
 * @param repoRoot  Absolute path to the repo root (where data/ lives)
 */
export async function fetchAndWrite(repoRoot: string): Promise<FetchResult> {
  const uPath = usagePath(repoRoot);
  const hPath = historyPath(repoRoot);
  const fetchedAt = new Date().toISOString();

  // --- 1. Resolve token (proactively refreshes if expired/near-expiry) ---
  let token: string;
  try {
    token = await getFreshAccessToken();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    writeError(uPath, "token-unresolved", detail, fetchedAt);
    return { success: false, errorCode: "token-unresolved" };
  }

  const requestUsage = (bearer: string): Promise<Response> =>
    fetch(USAGE_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

  // --- 2. Fetch endpoint (one forced refresh-and-retry on 401) ---
  let raw: RawUsageResponse;
  try {
    let resp = await requestUsage(token);

    // A 401 despite the proactive refresh means the cached expiry was wrong
    // (clock skew, server-side revocation). Force one refresh and retry.
    if (resp.status === 401) {
      const refreshed = await refreshAndPersist();
      if (refreshed) resp = await requestUsage(refreshed);
    }

    if (resp.status === 401) {
      writeError(
        uPath,
        "http-401",
        "Authentication failed (401) — OAuth token may be expired. Re-sign in to Claude Code.",
        fetchedAt
      );
      return { success: false, errorCode: "http-401" };
    }

    if (!resp.ok) {
      const code = `http-${resp.status}`;
      writeError(uPath, code, `HTTP ${resp.status} from usage endpoint`, fetchedAt);
      return { success: false, errorCode: code };
    }

    raw = (await resp.json()) as RawUsageResponse;
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const code = isTimeout ? "timeout" : "network-error";
    const detail = isTimeout
      ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`
      : `Network error: ${err instanceof Error ? err.message : String(err)}`;
    writeError(uPath, code, detail, fetchedAt);
    return { success: false, errorCode: code };
  }

  // --- 3. Normalize and write ---
  const snapshot = normalizeUsage(raw, fetchedAt);
  atomicWriteJson(uPath, snapshot);

  const existingHistory = readJsonFile<HistoryPoint[]>(hPath) ?? [];
  const updatedHistory = appendHistory(existingHistory, snapshot);
  atomicWriteJson(hPath, updatedHistory);

  return { success: true };
}
