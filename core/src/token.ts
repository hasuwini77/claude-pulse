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

import { execSync, execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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

/**
 * `security ... -w` prints the password as a hex string when the stored value
 * contains non-ASCII bytes. Real Claude tokens are ASCII, but decode defensively
 * so a non-ASCII field in the credentials blob never silently breaks parsing.
 */
function decodeKeychainOutput(raw: string): string {
  if (raw.length >= 2 && raw.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(raw)) {
    try {
      return Buffer.from(raw, "hex").toString("utf8");
    } catch {
      /* fall through — return as-is */
    }
  }
  return raw;
}

/** Attempt to read token from macOS Keychain. Only runs on darwin. */
function resolveFromKeychain(): string | null {
  if (process.platform !== "darwin") return null;

  const serviceNames = ["Claude Code-credentials", "Claude Code"];
  for (const service of serviceNames) {
    try {
      const raw = decodeKeychainOutput(
        execSync(`security find-generic-password -s "${service}" -w`, {
          stdio: ["pipe", "pipe", "pipe"],
        })
          .toString()
          .trim()
      );

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

// ─────────────────────────────────────────────────────────────────────────
// Full credential bundle: resolve access + refresh + expiry, and write a
// refreshed record back to its source. The resolver functions above hand back
// a bare access-token string for read-only use; refresh.ts needs the whole
// record (to refresh) and a way to persist the rotated tokens (so Claude Code
// and the next fetch stay in sync). Sibling keys (e.g. mcpOAuth) are preserved.
// ─────────────────────────────────────────────────────────────────────────

const KEYCHAIN_SERVICE = "Claude Code-credentials";

export interface OAuthCreds {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  [key: string]: unknown;
}

export type CredentialSource =
  | { kind: "file"; path: string }
  | { kind: "keychain"; service: string; account: string };

export interface CredentialBundle {
  /** Full parsed credentials object — preserve sibling keys on write-back. */
  raw: Record<string, unknown>;
  oauth: OAuthCreds;
  source: CredentialSource;
}

function parseBundle(
  text: string
): { raw: Record<string, unknown>; oauth: OAuthCreds } | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  const oauth = parsed?.["claudeAiOauth"] as OAuthCreds | undefined;
  if (
    !oauth ||
    typeof oauth.accessToken !== "string" ||
    oauth.accessToken.length === 0
  ) {
    return null;
  }
  return { raw: parsed, oauth };
}

/** Read the keychain item's account name (darwin only) for write-back. */
function keychainAccount(service: string): string | null {
  try {
    const meta = execSync(`security find-generic-password -s "${service}"`, {
      stdio: ["pipe", "pipe", "pipe"],
    }).toString();
    const m = meta.match(/"acct"<blob>="([^"]*)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the full credential bundle (file first, then keychain on darwin).
 * Returns null when no usable credentials are found.
 */
export function resolveCredentialBundle(): CredentialBundle | null {
  // 1. File
  const filePath = credentialsFilePath();
  if (existsSync(filePath)) {
    try {
      const parsed = parseBundle(readFileSync(filePath, "utf8"));
      if (parsed) return { ...parsed, source: { kind: "file", path: filePath } };
    } catch {
      /* fall through to keychain */
    }
  }

  // 2. Keychain (darwin)
  if (process.platform === "darwin") {
    for (const service of [KEYCHAIN_SERVICE, "Claude Code"]) {
      try {
        const raw = decodeKeychainOutput(
          execSync(`security find-generic-password -s "${service}" -w`, {
            stdio: ["pipe", "pipe", "pipe"],
          })
            .toString()
            .trim()
        );
        const parsed = parseBundle(raw);
        if (parsed) {
          const account = keychainAccount(service);
          if (account) {
            return { ...parsed, source: { kind: "keychain", service, account } };
          }
        }
      } catch {
        /* try next service name */
      }
    }
  }

  return null;
}

/**
 * Persist a refreshed credential record back to its source.
 * SECURITY: token values are passed to `security` via execFileSync argv (no
 * shell, single-user machine) and are never logged. `raw` carries the original
 * sibling keys untouched.
 */
export function writeCredentialBundle(
  source: CredentialSource,
  raw: Record<string, unknown>
): void {
  const json = JSON.stringify(raw);
  if (source.kind === "file") {
    writeFileSync(source.path, json, { mode: 0o600 });
    try {
      chmodSync(source.path, 0o600);
    } catch {
      /* best-effort: tighten perms if the file pre-existed with looser mode */
    }
    return;
  }
  // -U updates the existing keychain item in place (keeps the same entry).
  execFileSync(
    "security",
    ["add-generic-password", "-U", "-a", source.account, "-s", source.service, "-w", json],
    { stdio: ["pipe", "pipe", "pipe"] }
  );
}

// Exported for testing only — do NOT use in production paths that log output.
export { resolveFromFile, resolveFromKeychain, credentialsFilePath };
