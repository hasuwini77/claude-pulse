#!/usr/bin/env node
// claude-pulse — conflict resolver for data files, shared by all schedulers.
// Usage: node merge-data.cjs <target> <ours> <theirs>
//   history.json → union of entries keyed by `t`, sorted ascending
//   usage.json   → whichever side has the newer fetched_at
// Exits non-zero on unparseable input so callers can fall back to
// taking one side wholesale.

const fs = require('fs');
const path = require('path');

const [target, oursPath, theirsPath] = process.argv.slice(2);
if (!target || !oursPath || !theirsPath) {
  console.error('usage: merge-data.cjs <target> <ours> <theirs>');
  process.exit(2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

let merged;
try {
  const ours = readJson(oursPath);
  const theirs = readJson(theirsPath);

  switch (path.basename(target)) {
    case 'history.json': {
      const byT = new Map();
      for (const entry of [...ours, ...theirs]) byT.set(entry.t, entry);
      merged = [...byT.values()].sort((a, b) =>
        String(a.t).localeCompare(String(b.t))
      );
      break;
    }
    case 'usage.json': {
      const ts = (side) => Date.parse(side?.fetched_at) || 0;
      merged = ts(theirs) >= ts(ours) ? theirs : ours;
      break;
    }
    default:
      console.error(`merge-data.cjs: no strategy for ${target}`);
      process.exit(2);
  }
} catch (err) {
  console.error(`merge-data.cjs: ${err.message}`);
  process.exit(1);
}

fs.writeFileSync(target, JSON.stringify(merged, null, 2) + '\n');
