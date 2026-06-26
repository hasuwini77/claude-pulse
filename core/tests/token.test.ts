/**
 * Tests for token resolution precedence.
 * Uses jest.unstable_mockModule (required for ESM node: protocol imports).
 * Mocks are defined before any dynamic imports.
 */

import { jest, beforeEach, describe, it, expect } from "@jest/globals";

// --- Mock setup BEFORE any imports that use these modules ---

const mockExistsSync = jest.fn<() => boolean>();
const mockReadFileSync = jest.fn<() => string>();
const mockExecSync = jest.fn<() => Buffer>();

jest.unstable_mockModule("node:fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  // Other fs functions used by token.ts write-back — no-ops here.
  mkdirSync: jest.fn(),
  renameSync: jest.fn(),
  writeFileSync: jest.fn(),
  chmodSync: jest.fn(),
}));

jest.unstable_mockModule("node:child_process", () => ({
  execSync: mockExecSync,
  execFileSync: jest.fn(),
}));

// Dynamic import AFTER mock registration
const { resolveFromFile, resolveFromKeychain, resolveToken } = await import(
  "../src/token.js"
);

// ---

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolveFromFile", () => {
  it("returns null when credentials file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(resolveFromFile()).toBeNull();
  });

  it("returns null when file contains invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("not json");
    expect(resolveFromFile()).toBeNull();
  });

  it("returns null when claudeAiOauth is missing", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ other: "stuff" }));
    expect(resolveFromFile()).toBeNull();
  });

  it("returns null when accessToken is empty string", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ claudeAiOauth: { accessToken: "" } })
    );
    expect(resolveFromFile()).toBeNull();
  });

  it("returns the accessToken when file is valid", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ claudeAiOauth: { accessToken: "test-token-abc" } })
    );
    expect(resolveFromFile()).toBe("test-token-abc");
  });

  it("does NOT log the token value to console or stderr", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(
      () => true
    );
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ claudeAiOauth: { accessToken: "super-secret-token" } })
    );
    resolveFromFile();
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});

describe("resolveFromKeychain", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
    });
  });

  it("returns null on non-darwin platforms (no execSync call)", () => {
    Object.defineProperty(process, "platform", { value: "linux", writable: true });
    expect(resolveFromKeychain()).toBeNull();
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it("returns token from keychain on darwin — first service name succeeds", () => {
    Object.defineProperty(process, "platform", { value: "darwin", writable: true });
    mockExecSync.mockReturnValueOnce(
      Buffer.from(JSON.stringify({ claudeAiOauth: { accessToken: "keychain-token" } }))
    );
    expect(resolveFromKeychain()).toBe("keychain-token");
    expect(mockExecSync).toHaveBeenCalledTimes(1);
  });

  it("falls back to second service name when first throws", () => {
    Object.defineProperty(process, "platform", { value: "darwin", writable: true });
    mockExecSync
      .mockImplementationOnce(() => { throw new Error("not found"); })
      .mockReturnValueOnce(Buffer.from("raw-token-value"));
    expect(resolveFromKeychain()).toBe("raw-token-value");
    expect(mockExecSync).toHaveBeenCalledTimes(2);
  });

  it("returns null when both service names fail", () => {
    Object.defineProperty(process, "platform", { value: "darwin", writable: true });
    mockExecSync.mockImplementation(() => { throw new Error("not found"); });
    expect(resolveFromKeychain()).toBeNull();
    expect(mockExecSync).toHaveBeenCalledTimes(2);
  });
});

describe("resolveToken — precedence", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
    });
  });

  it("prefers file over keychain — keychain never called when file resolves", () => {
    Object.defineProperty(process, "platform", { value: "darwin", writable: true });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ claudeAiOauth: { accessToken: "file-token" } })
    );
    mockExecSync.mockReturnValue(Buffer.from("should-not-be-used"));

    expect(resolveToken()).toBe("file-token");
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it("falls back to keychain when file is missing (darwin)", () => {
    Object.defineProperty(process, "platform", { value: "darwin", writable: true });
    mockExistsSync.mockReturnValue(false);
    mockExecSync.mockReturnValueOnce(Buffer.from("keychain-fallback"));

    expect(resolveToken()).toBe("keychain-fallback");
  });

  it("throws with descriptive message when nothing resolves (linux)", () => {
    Object.defineProperty(process, "platform", { value: "linux", writable: true });
    mockExistsSync.mockReturnValue(false);
    expect(() => resolveToken()).toThrow(/Cannot resolve Claude OAuth token/);
    expect(() => resolveToken()).toThrow(/\.credentials\.json/);
  });

  it("throws when file has no token and keychain unavailable (linux)", () => {
    Object.defineProperty(process, "platform", { value: "linux", writable: true });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ other: "data" }));
    expect(() => resolveToken()).toThrow();
  });
});
