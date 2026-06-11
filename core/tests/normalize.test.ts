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

describe("errorSnapshot", () => {
  it("sets error to the provided message", () => {
    const snap = errorSnapshot("Network timeout", FETCHED_AT);
    expect(snap.error).toBe("Network timeout");
  });

  it("all windows are null when no lastGood provided", () => {
    const snap = errorSnapshot("fail", FETCHED_AT);
    expect(snap.five_hour.utilization).toBeNull();
    expect(snap.weekly.utilization).toBeNull();
    expect(snap.weekly_sonnet.utilization).toBeNull();
    expect(snap.weekly_opus.utilization).toBeNull();
  });

  it("preserves last-good window values when provided", () => {
    const lastGood = normalizeUsage(FIXTURE_RAW, FETCHED_AT);
    const snap = errorSnapshot("401 Unauthorized", "2026-06-11T12:00:00.000Z", lastGood);
    expect(snap.error).toBe("401 Unauthorized");
    expect(snap.five_hour.utilization).toBe(25.0);
    expect(snap.weekly.utilization).toBe(26.0);
    // fetched_at updated to the new timestamp
    expect(snap.fetched_at).toBe("2026-06-11T12:00:00.000Z");
  });
});
