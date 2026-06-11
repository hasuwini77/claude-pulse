import type { Severity } from '../types'

/** ok < 60 ≤ warn < 85 ≤ crit */
export function severity(util: number | null | undefined): Severity {
  if (util == null) return 'ok'
  if (util >= 85) return 'crit'
  if (util >= 60) return 'warn'
  return 'ok'
}

export const SEVERITY_CSS: Record<Severity, string> = {
  ok:   'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
}

export const SEVERITY_CLASS: Record<Severity, string> = {
  ok:   'text-[oklch(0.71_0.177_145)]',
  warn: 'text-[oklch(0.78_0.172_75)]',
  crit: 'text-[oklch(0.65_0.218_25)]',
}
