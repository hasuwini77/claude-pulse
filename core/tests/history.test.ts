import { appendHistory, type HistoryPoint } from "../src/history.js";
import type { UsageSnapshot } from "../src/normalize.js";

function makeSnapshot(fetchedAt: string, fiveHour: number, weekly: number): UsageSnapshot {
  return {
    fetched_at: fetchedAt,
    five_hour: { utilization: fiveHour, resets_at: null },
    weekly: { utilization: weekly, resets_at: null },
    weekly_sonnet: { utilization: null, resets_at: null },
    weekly_opus: { utilization: null, resets_at: null },
    extra_usage: { enabled: false, monthly_limit: 0, used_credits: 0, currency: "EUR" },
    error: null,
  };
}

describe("appendHistory", () => {
  it("appends a new point to empty history", () => {
    const snap = makeSnapshot("2026-06-11T12:00:00.000Z", 25, 30);
    const result = appendHistory([], snap);
    expect(result).toHaveLength(1);
    expect(result[0].t).toBe("2026-06-11T12:00:00.000Z");
    expect(result[0].five_hour).toBe(25);
    expect(result[0].weekly).toBe(30);
  });

  it("keeps points within the last 7 days", () => {
    const base = new Date("2026-06-11T12:00:00.000Z").getTime();
    const existing: HistoryPoint[] = [
      { t: new Date(base - 6 * 24 * 60 * 60 * 1000).toISOString(), five_hour: 10, weekly: 10 },
      { t: new Date(base - 3 * 24 * 60 * 60 * 1000).toISOString(), five_hour: 20, weekly: 20 },
    ];
    const snap = makeSnapshot("2026-06-11T12:00:00.000Z", 30, 30);
    const result = appendHistory(existing, snap);
    // All 3 are within 7 days of the newest point
    expect(result).toHaveLength(3);
  });

  it("removes points older than 7 days", () => {
    const base = new Date("2026-06-11T12:00:00.000Z").getTime();
    const existing: HistoryPoint[] = [
      // 8 days old — should be removed
      { t: new Date(base - 8 * 24 * 60 * 60 * 1000).toISOString(), five_hour: 5, weekly: 5 },
      // 6 days old — should be kept
      { t: new Date(base - 6 * 24 * 60 * 60 * 1000).toISOString(), five_hour: 15, weekly: 15 },
    ];
    const snap = makeSnapshot("2026-06-11T12:00:00.000Z", 30, 30);
    const result = appendHistory(existing, snap);
    expect(result).toHaveLength(2);
    expect(result[0].five_hour).toBe(15);
    expect(result[1].five_hour).toBe(30);
  });

  it("passes null utilization values through", () => {
    const snap = makeSnapshot("2026-06-11T12:00:00.000Z", 0, 0);
    snap.five_hour.utilization = null;
    snap.weekly.utilization = null;
    const result = appendHistory([], snap);
    expect(result[0].five_hour).toBeNull();
    expect(result[0].weekly).toBeNull();
  });

  it("does not mutate the existing array", () => {
    const existing: HistoryPoint[] = [
      { t: "2026-06-10T12:00:00.000Z", five_hour: 10, weekly: 10 },
    ];
    const snap = makeSnapshot("2026-06-11T12:00:00.000Z", 20, 20);
    appendHistory(existing, snap);
    expect(existing).toHaveLength(1);
  });
});
