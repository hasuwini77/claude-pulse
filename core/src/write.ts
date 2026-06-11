/**
 * Atomic file writer.
 *
 * Writes to a temp file in os.tmpdir() first, then renames atomically.
 * Using os.tmpdir() (not data/.foo.tmp) ensures the temp file is never
 * staged by `git add data/` if the process dies before rename.
 *
 * Cross-device (EXDEV) fallback: copies the temp file to the destination
 * and unlinks the temp — not atomic, but safe against partial writes since
 * the destination is replaced in one syscall (on Linux/macOS).
 */

import {
  copyFileSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

let _seq = 0;

function tmpPath(targetFile: string): string {
  // Unique per-call: pid + monotonic sequence avoids collisions during parallel runs
  _seq += 1;
  return join(tmpdir(), `.claude-pulse-${process.pid}-${_seq}-${basename(targetFile)}`);
}

export function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const tmp = tmpPath(filePath);
  const json = JSON.stringify(data, null, 2);
  writeFileSync(tmp, json, "utf8");

  try {
    renameSync(tmp, filePath);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EXDEV") {
      // Cross-device link: fall back to copy + unlink
      try {
        copyFileSync(tmp, filePath);
      } finally {
        try { unlinkSync(tmp); } catch { /* best-effort cleanup */ }
      }
    } else {
      try { unlinkSync(tmp); } catch { /* best-effort cleanup */ }
      throw err;
    }
  }
}
