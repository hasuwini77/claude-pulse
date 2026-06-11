/**
 * Atomic file writer.
 * Writes to a .tmp file first, then renames — prevents corrupt reads
 * if the process is killed mid-write.
 */

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const tmp = `${filePath}.tmp`;
  const json = JSON.stringify(data, null, 2);
  writeFileSync(tmp, json, "utf8");
  renameSync(tmp, filePath);
}
