/**
 * history.json management.
 * Append a point from the current usage snapshot, then cap to the last 7 days.
 */

import type { UsageSnapshot } from "./normalize.js";

export interface HistoryPoint {
  t: string;
  five_hour: number | null;
  weekly: number | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Given the existing history array and a fresh snapshot, return the updated array
 * with the new point appended and entries older than 7 days removed.
 */
export function appendHistory(
  existing: HistoryPoint[],
  snapshot: UsageSnapshot
): HistoryPoint[] {
  const newPoint: HistoryPoint = {
    t: snapshot.fetched_at,
    five_hour: snapshot.five_hour.utilization,
    weekly: snapshot.weekly.utilization,
  };

  const updated = [...existing, newPoint];

  // Cap: keep only points within the last 7 days relative to the newest point
  const newestTime = new Date(newPoint.t).getTime();
  const cutoff = newestTime - SEVEN_DAYS_MS;

  return updated.filter((p) => {
    const t = new Date(p.t).getTime();
    return !isNaN(t) && t >= cutoff;
  });
}
