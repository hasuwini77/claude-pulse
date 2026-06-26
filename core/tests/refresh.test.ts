/**
 * Tests for OAuth token refresh.
 * Mocks ../src/token.js (resolution + write-back) and global fetch.
 */

import { jest, beforeEach, afterEach, describe, it, expect } from "@jest/globals";

const mockResolveBundle = jest.fn<() => unknown>();
const mockWriteBundle = jest.fn<(...a: unknown[]) => void>();

jest.unstable_mockModule("../src/token.js", () => ({
  resolveCredentialBundle: mockResolveBundle,
  writeCredentialBundle: mockWriteBundle,
}));

const { getFreshAccessToken, refreshAndPersist } = await import("../src/refresh.js");

const FRESH_BUNDLE = () => ({
  raw: { mcpOAuth: { keep: "me" }, claudeAiOauth: { accessToken: "cached", refreshToken: "rt-1", expiresAt: Date.now() + 60 * 60 * 1000 } },
  oauth: { accessToken: "cached", refreshToken: "rt-1", expiresAt: Date.now() + 60 * 60 * 1000 },
  source: { kind: "keychain", service: "Claude Code-credentials", account: "tester" },
});

const EXPIRED_BUNDLE = () => ({
  raw: { mcpOAuth: { keep: "me" }, claudeAiOauth: { accessToken: "cached", refreshToken: "rt-1", expiresAt: Date.now() - 1000 } },
  oauth: { accessToken: "cached", refreshToken: "rt-1", expiresAt: Date.now() - 1000 },
  source: { kind: "keychain", service: "Claude Code-credentials", account: "tester" },
});

const realFetch = globalThis.fetch;
let stderrSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  jest.clearAllMocks();
  stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  stderrSpy.mockRestore();
});

function mockFetchOnce(status: number, body: unknown) {
  globalThis.fetch = jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("getFreshAccessToken", () => {
  it("returns the cached token without refreshing when still fresh", async () => {
    mockResolveBundle.mockReturnValue(FRESH_BUNDLE());
    globalThis.fetch = jest.fn(() => { throw new Error("must not fetch"); }) as unknown as typeof fetch;

    await expect(getFreshAccessToken()).resolves.toBe("cached");
    expect(mockWriteBundle).not.toHaveBeenCalled();
  });

  it("refreshes when expired, persists rotated creds, returns new token", async () => {
    mockResolveBundle.mockReturnValue(EXPIRED_BUNDLE());
    mockFetchOnce(200, { access_token: "new-at", refresh_token: "rt-2", expires_in: 3600 });

    await expect(getFreshAccessToken()).resolves.toBe("new-at");
    expect(mockWriteBundle).toHaveBeenCalledTimes(1);
    const [, rawWritten] = mockWriteBundle.mock.calls[0] as [unknown, any];
    expect(rawWritten.claudeAiOauth.accessToken).toBe("new-at");
    expect(rawWritten.claudeAiOauth.refreshToken).toBe("rt-2");
    expect(rawWritten.claudeAiOauth.expiresAt).toBeGreaterThan(Date.now());
    expect(rawWritten.mcpOAuth).toEqual({ keep: "me" }); // sibling preserved
  });

  it("falls back to the cached token when refresh fails (HTTP 400)", async () => {
    mockResolveBundle.mockReturnValue(EXPIRED_BUNDLE());
    mockFetchOnce(400, { error: "invalid_grant" });

    await expect(getFreshAccessToken()).resolves.toBe("cached");
    expect(mockWriteBundle).not.toHaveBeenCalled();
  });

  it("throws when no credentials resolve at all", async () => {
    mockResolveBundle.mockReturnValue(null);
    await expect(getFreshAccessToken()).rejects.toThrow(/Cannot resolve Claude OAuth credentials/);
  });
});

describe("refreshAndPersist", () => {
  it("returns null when the refresh response is incomplete", async () => {
    mockResolveBundle.mockReturnValue(EXPIRED_BUNDLE());
    mockFetchOnce(200, { access_token: "only-access" }); // missing refresh_token/expires_in
    await expect(refreshAndPersist()).resolves.toBeNull();
    expect(mockWriteBundle).not.toHaveBeenCalled();
  });

  it("returns null when there is no refresh token", async () => {
    mockResolveBundle.mockReturnValue({
      raw: { claudeAiOauth: { accessToken: "cached" } },
      oauth: { accessToken: "cached" },
      source: { kind: "keychain", service: "s", account: "a" },
    });
    await expect(refreshAndPersist()).resolves.toBeNull();
  });
});
