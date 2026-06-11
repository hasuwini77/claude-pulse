import { normalizeUsage, errorSnapshot, type RawUsageResponse } from "../src/normalize.js";

const FIXTURE_RAW: RawUsageResponse = {
  five_hour: { utilization: 25.0, resets_at: "2026-06-11T09:59:59.980464+00:00" },
  seven_day: { utilization: 26.0, resets_at: "2026-06-12T17:59:59.980485+00:00" },
  seven_day_opus: null,
  seven_day_sonnet: { utilization: 23.0, resets_at: "2026-06-12T18:00:00.980491+00:00" },
  extra_usage: {
    is_enabled: true,
    monthly_limit: 17000,
    used_credits: 0.0,
    utilization: null,
    currency: "EUR",
    disabled_reason: null,
  },
};

const FETCHED_AT = "2026-06-11T11:30:00.000Z";

describe("normalizeUsage", () => {
  it("maps five_hour from raw", () => {
    const snap = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    expect(snap.five_hour.utilization).toBe(25.0);
    expect(snap.five_hour.resets_at).toBe("2026-06-11T09:59:59.980464+00:00");
  });

  it("maps seven_day → weekly", () => {
    const snap = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    expect(snap.weekly.utilization).toBe(26.0);
    expect(snap.weekly.resets_at).toBe("2026-06-12T17:59:59.980485+00:00");
  });

  it("maps seven_day_sonnet → weekly_sonnet", () => {
    const snap = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    expect(snap.weekly_sonnet.utilization).toBe(23.0);
  });

  it("maps null seven_day_opus → weekly_opus with null values", () => {
    const snap = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    expect(snap.weekly_opus.utilization).toBeNull();
    expect(snap.weekly_opus.resets_at).toBeNull();
  });

  it("maps extra_usage fields (is_enabled → enabled)", () => {
    const snap = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    expect(snap.extra_usage.enabled).toBe(true);
    expect(snap.extra_usage.monthly_limit).toBe(17000);
    expect(snap.extra_usage.used_credits).toBe(0.0);
    expect(snap.extra_usage.currency).toBe("EUR");
  });

  it("sets fetched_at to the provided timestamp", () => {
    const snap = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    expect(snap.fetched_at).toBe(FETCHED_AT);
  });

  it("sets error to null on success", () => {
    const snap = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    expect(snap.error).toBeNull();
  });

  it("ignores unknown top-level keys", () => {
    const rawWithExtra: RawUsageResponse = {
      ...FIXTURE_RAW,
      seven_day_cowork: { utilization: 10, resets_at: "2026-06-12T00:00:00Z" },
      tangelo: null,
    };
    // Should not throw, should produce same output
    const snap = normalizeUsage(rawWithExtra, FETCHED_AT);
    expect(snap.five_hour.utilization).toBe(25.0);
  });

  it("handles null five_hour gracefully", () => {
    const raw: RawUsageResponse = { ...FIXTURE_RAW, five_hour: null };
    const snap = normalizeUsage(raw, FETCHED_AT);
    expect(snap.five_hour.utilization).toBeNull();
    expect(snap.five_hour.resets_at).toBeNull();
  });

  it("handles null extra_usage gracefully", () => {
    const raw: RawUsageResponse = { ...FIXTURE_RAW, extra_usage: null };
    const snap = normalizeUsage(raw, FETCHED_AT);
    expect(snap.extra_usage.enabled).toBe(false);
    expect(snap.extra_usage.monthly_limit).toBe(0);
  });
});

const ATTEMPT_AT = "2026-06-11T12:00:00.000Z"; // simulates a later failed-attempt time

describe("errorSnapshot", () => {
  it("sets error to the provided code", () => {
    const snap = errorSnapshot("network-error", ATTEMPT_AT);
    expect(snap.error).toBe("network-error");
  });

  it("sets last_attempt_at to the attempt timestamp", () => {
    const snap = errorSnapshot("network-error", ATTEMPT_AT);
    expect(snap.last_attempt_at).toBe(ATTEMPT_AT);
  });

  it("all windows are null when no lastGood provided", () => {
    const snap = errorSnapshot("fail", ATTEMPT_AT);
    expect(snap.five_hour.utilization).toBeNull();
    expect(snap.weekly.utilization).toBeNull();
    expect(snap.weekly_sonnet.utilization).toBeNull();
    expect(snap.weekly_opus.utilization).toBeNull();
  });

  it("uses attempt time as fetched_at when there is no prior data", () => {
    const snap = errorSnapshot("token-unresolved", ATTEMPT_AT);
    // No lastGood — best available timestamp is the attempt itself
    expect(snap.fetched_at).toBe(ATTEMPT_AT);
  });

  it("preserves last-good window values when provided", () => {
    const lastGood = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    const snap = errorSnapshot("http-401", ATTEMPT_AT, lastGood);
    expect(snap.error).toBe("http-401");
    expect(snap.five_hour.utilization).toBe(25.0);
    expect(snap.weekly.utilization).toBe(26.0);
  });

  it("preserves last-good fetched_at — does NOT bump it to the attempt time", () => {
    const lastGood = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    const snap = errorSnapshot("http-401", ATTEMPT_AT, lastGood);
    // fetched_at must reflect when the DATA was valid, not when the failed attempt happened
    expect(snap.fetched_at).toBe(FETCHED_AT);
    expect(snap.last_attempt_at).toBe(ATTEMPT_AT);
  });

  it("normalizeUsage (success path) has no last_attempt_at", () => {
    const snap = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    expect(snap.last_attempt_at).toBeUndefined();
    expect(snap.error).toBeNull();
  });
});
