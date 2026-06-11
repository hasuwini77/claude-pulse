#!/usr/bin/env node
/**
 * claude-pulse statusline segment
 *
 * Reads data/usage.json (the cached snapshot — never hits the network) and
 * prints ONE compact ANSI-colored line suitable for Claude Code statusLine.command.
 *
 * Output format:  ◔ 5h 25%  ◔ wk 26% ⟳ 2d  ⚡€0/17k  (countdown in amber)
 * Degraded:       ◔ 5h --  ◔ wk --  ⚡ --
 *
 * Color thresholds (applied per utilization value):
 *   green  < 60
 *   amber  60 ≤ x < 85
 *   red    ≥ 85
 *
 * Stale threshold: fetched_at older than 30 minutes → treat all values as missing.
 *
 * SECURITY: reads only usage.json — never the credentials file, never the network.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// --- ANSI helpers ---
const GREEN  = "\x1b[32m";
const AMBER  = "\x1b[33m";
const RED    = "\x1b[31m";
const DIM    = "\x1b[2m";
const RESET  = "\x1b[0m";
// Accent for the window icon + label — the % value keeps its severity color.
// 5h = normal/default text; wk = light pink (#FF8FC8).
// (The orchid-purple #C792EA now lives on the git-branch segment in the statusline wrapper.)
const PINK = "\x1b[38;2;255;143;200m";

function colorFor(util) {
  if (util === null || util === undefined) return DIM;
  if (util >= 85) return RED;
  if (util >= 60) return AMBER;
  return GREEN;
}

function colorize(text, util) {
  return `${colorFor(util)}${text}${RESET}`;
}

// --- Reset countdown formatter ---
function formatCountdown(resetsAt) {
  if (!resetsAt) return null;
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return null;

  const totalSec = Math.floor(ms / 1000);
  const days     = Math.floor(totalSec / 86400);
  const hours    = Math.floor((totalSec % 86400) / 3600);
  const mins     = Math.floor((totalSec % 3600) / 60);

  if (days > 0) return `${days}d${hours > 0 ? ` ${hours}h` : ""}`;
  if (hours > 0) return `${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
  return `${mins}m`;
}

// --- Find data/usage.json relative to this script ---
function resolveDataPath() {
  // statusline/ sits one level below the repo root → ../data/usage.json
  const candidates = [
    path.resolve(__dirname, "..", "data", "usage.json"),
    // Fallback: if run from repo root
    path.resolve(process.cwd(), "data", "usage.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]; // return primary even if missing — handled below
}

// --- Stale check: if fetched_at > 30 min ago, data is stale ---
const STALE_MS = 30 * 60 * 1000;

function isStale(fetchedAt) {
  if (!fetchedAt) return true;
  const age = Date.now() - new Date(fetchedAt).getTime();
  return isNaN(age) || age > STALE_MS;
}

// --- Format a utilization % ---
function fmtPct(util) {
  if (util === null || util === undefined) return "--";
  return `${Math.round(util)}%`;
}

// --- Format extra usage credits ---
function fmtCredits(extra) {
  if (!extra) return null;
  const { used_credits, monthly_limit, currency } = extra;
  if (monthly_limit == null) return null;
  const sym = currency === "EUR" ? "€" : currency;
  const used = used_credits != null ? Math.round(used_credits) : 0;
  const limit = monthly_limit >= 1000 ? `${Math.round(monthly_limit / 1000)}k` : String(monthly_limit);
  return `${sym}${used}/${limit}`;
}

// --- Main ---
function main() {
  const dataPath = resolveDataPath();

  let snapshot = null;
  let noData = false; // true only when file is completely absent or unreadable

  if (!fs.existsSync(dataPath)) {
    noData = true;
  } else {
    try {
      const raw = fs.readFileSync(dataPath, "utf8");
      snapshot = JSON.parse(raw);
    } catch {
      noData = true;
    }
  }

  if (noData || !snapshot) {
    // Full degrade — no usable data at all
    process.stdout.write(
      `${DIM}◔ 5h --  ◔ wk --  ⚡ --${RESET}\n`
    );
    return;
  }

  // Show a red ! when data is stale (fetched_at age > 30 min) OR fetch failed.
  // With core now preserving fetched_at on error, isStale() correctly catches
  // both a stopped scheduler and a prolonged fetch failure.
  const showWarning = isStale(snapshot.fetched_at) || snapshot.error != null;

  const parts = [];

  // --- 5-hour window ---
  const fh = snapshot.five_hour;
  const fhUtil = fh?.utilization ?? null;
  const fhPct = fmtPct(fhUtil);
  parts.push(`◔ 5h ${colorize(fhPct, fhUtil)}`);

  // --- Weekly window ---
  const wk = snapshot.weekly;
  const wkUtil = wk?.utilization ?? null;
  const wkPct = fmtPct(wkUtil);
  const wkCountdown = wk?.resets_at ? formatCountdown(wk.resets_at) : null;
  const wkReset = wkCountdown ? ` ${AMBER}⟳ ${wkCountdown}${RESET}` : "";
  parts.push(`${PINK}◔ wk${RESET} ${colorize(wkPct, wkUtil)}${wkReset}`);

  // --- Extra usage credits ---
  const credits = fmtCredits(snapshot.extra_usage);
  if (credits) {
    parts.push(`⚡${credits}`);
  }

  // Stale or error: values shown but clearly flagged as not current
  const warningMarker = showWarning ? `  ${RED}!${RESET}` : "";

  process.stdout.write(parts.join("  ") + warningMarker + "\n");
}

main();
