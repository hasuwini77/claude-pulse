/**
 * Core fetcher: resolve token → GET usage endpoint → normalize → write data files.
 *
 * SECURITY: token is read once, used for the single HTTP request, then discarded.
 * It is NEVER logged, written to disk, or returned from this module.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appendHistory, type HistoryPoint } from "./history.js";
import { errorSnapshot, normalizeUsage, type RawUsageResponse, type UsageSnapshot } from "./normalize.js";
import { resolveToken } from "./token.js";
import { atomicWriteJson } from "./write.js";

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";

function dataDir(repoRoot: string): string {
  return resolve(repoRoot, "data");
}

function usagePath(repoRoot: string): string {
  return resolve(dataDir(repoRoot), "usage.json");
}

function historyPath(repoRoot: string): string {
  return resolve(dataDir(repoRoot), "history.json");
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

export interface FetchResult {
  success: boolean;
  errorMessage?: string;
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

  let token: string;
  try {
    token = resolveToken();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lastGood = readJsonFile<UsageSnapshot>(uPath);
    atomicWriteJson(uPath, errorSnapshot(msg, fetchedAt, lastGood));
    return { success: false, errorMessage: msg };
  }

  let raw: RawUsageResponse;
  try {
    const resp = await fetch(USAGE_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
      },
    });

    if (resp.status === 401) {
      const msg = "Authentication failed (401) — OAuth token may be expired. Re-sign in to Claude Code.";
      const lastGood = readJsonFile<UsageSnapshot>(uPath);
      atomicWriteJson(uPath, errorSnapshot(msg, fetchedAt, lastGood));
      return { success: false, errorMessage: msg };
    }

    if (!resp.ok) {
      const msg = `HTTP ${resp.status} from usage endpoint`;
      const lastGood = readJsonFile<UsageSnapshot>(uPath);
      atomicWriteJson(uPath, errorSnapshot(msg, fetchedAt, lastGood));
      return { success: false, errorMessage: msg };
    }

    raw = (await resp.json()) as RawUsageResponse;
  } catch (err) {
    const msg = `Network error: ${err instanceof Error ? err.message : String(err)}`;
    const lastGood = readJsonFile<UsageSnapshot>(uPath);
    atomicWriteJson(uPath, errorSnapshot(msg, fetchedAt, lastGood));
    return { success: false, errorMessage: msg };
  }

  const snapshot = normalizeUsage(raw, fetchedAt);

  // Write usage.json atomically
  atomicWriteJson(uPath, snapshot);

  // Append to history.json and cap to 7 days
  const existingHistory = readJsonFile<HistoryPoint[]>(hPath) ?? [];
  const updatedHistory = appendHistory(existingHistory, snapshot);
  atomicWriteJson(hPath, updatedHistory);

  return { success: true };
}
