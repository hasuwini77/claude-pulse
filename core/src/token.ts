/**
 * Cross-platform OAuth token resolver.
 * Priority:
 *   1. File: ~/.claude/.credentials.json → claudeAiOauth.accessToken
 *      (Windows: %USERPROFILE%\.claude\.credentials.json)
 *   2. macOS Keychain: security find-generic-password -s "Claude Code-credentials" -w
 *      fallback service name: "Claude Code"
 *   3. Throws — never invents a token.
 *
 * SECURITY: returns the token value only; never logs it, never writes it to any file.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface CredentialsFile {
  claudeAiOauth?: {
    accessToken?: string;
  };
}

/** Resolve the credentials file path cross-platform. */
function credentialsFilePath(): string {
  // Windows uses %USERPROFILE%; everywhere else it is ~/
  const base =
    process.platform === "win32"
      ? process.env["USERPROFILE"] ?? homedir()
      : homedir();
  return join(base, ".claude", ".credentials.json");
}

/** Attempt to read token from ~/.claude/.credentials.json */
function resolveFromFile(): string | null {
  const filePath = credentialsFilePath();
  if (!existsSync(filePath)) return null;

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  let parsed: CredentialsFile;
  try {
    parsed = JSON.parse(raw) as CredentialsFile;
  } catch {
    return null;
  }

  const token = parsed?.claudeAiOauth?.accessToken;
  if (typeof token === "string" && token.length > 0) {
    return token;
  }
  return null;
}

/** Attempt to read token from macOS Keychain. Only runs on darwin. */
function resolveFromKeychain(): string | null {
  if (process.platform !== "darwin") return null;

  const serviceNames = ["Claude Code-credentials", "Claude Code"];
  for (const service of serviceNames) {
    try {
      const raw = execSync(
        `security find-generic-password -s "${service}" -w`,
        { stdio: ["pipe", "pipe", "pipe"] }
      )
        .toString()
        .trim();

      // The output may be a JSON string with the token inside, or the raw token itself.
      // Try to parse it as JSON first.
      let token: string | null = null;
      if (raw.startsWith("{")) {
        try {
          const parsed = JSON.parse(raw) as CredentialsFile;
          token = parsed?.claudeAiOauth?.accessToken ?? null;
        } catch {
          // Not JSON — treat the output as the raw token
          token = raw;
        }
      } else {
        token = raw;
      }

      if (typeof token === "string" && token.length > 0) {
        return token;
      }
    } catch {
      // This service name not found — try next
    }
  }
  return null;
}

/**
 * Resolve the Claude OAuth access token.
 * Throws a descriptive error if no token can be found.
 */
export function resolveToken(): string {
  const fromFile = resolveFromFile();
  if (fromFile !== null) return fromFile;

  const fromKeychain = resolveFromKeychain();
  if (fromKeychain !== null) return fromKeychain;

  const creds = credentialsFilePath();
  throw new Error(
    `Cannot resolve Claude OAuth token.\n` +
      `Checked:\n` +
      `  1. File: ${creds}\n` +
      `  2. macOS Keychain (services: "Claude Code-credentials", "Claude Code")\n` +
      `Make sure Claude Code is installed and you are signed in.`
  );
}

// Exported for testing only — do NOT use in production paths that log output.
export { resolveFromFile, resolveFromKeychain, credentialsFilePath };
