/**
 * Normalize the raw Anthropic usage API response into the pinned usage.json contract.
 *
 * Raw shape (verified live):
 * {
 *   five_hour:         { utilization: number; resets_at: string } | null
 *   seven_day:         { utilization: number; resets_at: string } | null
 *   seven_day_opus:    { utilization: number; resets_at: string } | null
 *   seven_day_sonnet:  { utilization: number; resets_at: string } | null
 *   extra_usage:       { is_enabled: boolean; monthly_limit: number; used_credits: number;
 *                        utilization: number | null; currency: string; disabled_reason: string | null } | null
 *   // may contain additional unknown keys — ignored
 * }
 */

export interface UsageWindow {
  utilization: number | null;
  resets_at: string | null;
}

export interface ExtraUsage {
  enabled: boolean;
  monthly_limit: number;
  used_credits: number;
  currency: string;
}

export interface UsageSnapshot {
  /**
   * ISO8601 UTC — when the data was last SUCCESSFULLY fetched and is valid.
   * NOT bumped on failed attempts; consumers use this to detect staleness.
   * Falls back to the attempt time only when there is no prior successful fetch.
   */
  fetched_at: string;
  /**
   * ISO8601 UTC — when the last fetch attempt was made.
   * Present only when `error` is non-null (failed fetch).
   * Omitted on success (redundant with fetched_at).
   */
  last_attempt_at?: string;
  five_hour: UsageWindow;
  weekly: UsageWindow;
  weekly_sonnet: UsageWindow;
  weekly_opus: UsageWindow;
  extra_usage: ExtraUsage;
  error: string | null;
}

interface RawWindow {
  utilization?: number | null;
  resets_at?: string | null;
}

interface RawExtraUsage {
  is_enabled?: boolean;
  monthly_limit?: number;
  used_credits?: number;
  currency?: string;
  // Additional fields present in the live response — not mapped, only ignored gracefully
  utilization?: number | null;
  disabled_reason?: string | null;
  [key: string]: unknown;
}

export interface RawUsageResponse {
  five_hour?: RawWindow | null;
  seven_day?: RawWindow | null;
  seven_day_opus?: RawWindow | null;
  seven_day_sonnet?: RawWindow | null;
  extra_usage?: RawExtraUsage | null;
  [key: string]: unknown;
}

function normalizeWindow(raw: RawWindow | null | undefined): UsageWindow {
  if (!raw) return { utilization: null, resets_at: null };
  return {
    utilization: raw.utilization ?? null,
    resets_at: raw.resets_at ?? null,
  };
}

/**
 * Convert raw API response to the pinned usage.json contract.
 * fetchedAt should be an ISO8601 UTC string (e.g. new Date().toISOString()).
 */
export function normalizeUsage(
  raw: RawUsageResponse,
  fetchedAt: string
): UsageSnapshot {
  const extra = raw.extra_usage;
  return {
    fetched_at: fetchedAt,
    five_hour: normalizeWindow(raw.five_hour),
    weekly: normalizeWindow(raw.seven_day),
    weekly_sonnet: normalizeWindow(raw.seven_day_sonnet),
    weekly_opus: normalizeWindow(raw.seven_day_opus),
    extra_usage: {
      enabled: extra?.is_enabled ?? false,
      monthly_limit: extra?.monthly_limit ?? 0,
      used_credits: extra?.used_credits ?? 0,
      currency: extra?.currency ?? "EUR",
    },
    error: null,
  };
}

/**
 * Build an error snapshot preserving last-good window values and — critically —
 * preserving the last-good `fetched_at` so consumers can detect staleness correctly.
 *
 * @param errorCode      Short sanitized code written to the committed file.
 * @param lastAttemptAt  ISO8601 UTC — when this failed attempt was made.
 * @param lastGood       Previous successful snapshot (if any).
 */
export function errorSnapshot(
  errorCode: string,
  lastAttemptAt: string,
  lastGood?: UsageSnapshot | null
): UsageSnapshot {
  if (lastGood) {
    return {
      ...lastGood,
      // fetched_at stays as-is (last valid fetch time) — do NOT bump to now
      last_attempt_at: lastAttemptAt,
      error: errorCode,
    };
  }
  // No prior successful fetch — use attempt time as best available timestamp
  const nullWindow: UsageWindow = { utilization: null, resets_at: null };
  return {
    fetched_at: lastAttemptAt,
    last_attempt_at: lastAttemptAt,
    five_hour: nullWindow,
    weekly: nullWindow,
    weekly_sonnet: nullWindow,
    weekly_opus: nullWindow,
    extra_usage: { enabled: false, monthly_limit: 0, used_credits: 0, currency: "EUR" },
    error: errorCode,
  };
}
