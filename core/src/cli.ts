#!/usr/bin/env node
/**
 * claude-pulse CLI
 * Usage: claude-pulse fetch [--repo-root <path>]
 *
 * By default, --repo-root resolves to the parent of the `core/` directory,
 * which is the repo root where data/ lives.
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAndWrite } from "./fetcher.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]): { command: string; repoRoot: string } {
  const args = argv.slice(2);
  const command = args[0] ?? "fetch";

  let repoRoot: string | undefined;
  const rootIdx = args.indexOf("--repo-root");
  if (rootIdx !== -1 && args[rootIdx + 1]) {
    repoRoot = resolve(args[rootIdx + 1]);
  } else {
    // Default: dist/ is inside core/, one level up is the repo root
    repoRoot = resolve(__dirname, "..", "..");
  }

  return { command, repoRoot };
}

async function main(): Promise<void> {
  const { command, repoRoot } = parseArgs(process.argv);

  if (command === "fetch") {
    const result = await fetchAndWrite(repoRoot);
    if (result.success) {
      process.stdout.write("claude-pulse: fetch OK\n");
      process.exit(0);
    } else {
      process.stderr.write(`claude-pulse: fetch failed [${result.errorCode ?? "unknown"}] — see above for details\n`);
      process.exit(1);
    }
  } else {
    process.stderr.write(`claude-pulse: unknown command "${command}". Available: fetch\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`claude-pulse: unhandled error — ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
