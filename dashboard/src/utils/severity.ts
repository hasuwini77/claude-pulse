export type Sev = 'ok' | 'warn' | 'crit'

/** Contract: ok < 60 ≤ warn < 85 ≤ crit */
export const severity = (u: number | null): Sev =>
  u == null ? 'ok' : u >= 85 ? 'crit' : u >= 60 ? 'warn' : 'ok'

/** Status words carried inside the gauge center stack */
export const STATUS: Record<Sev, string> = {
  ok:   'NOMINAL',
  warn: 'ELEVATED',
  crit: 'CRITICAL',
}

/** CSS var for the current severity fill color */
export const sevColor = (sev: Sev) => `var(--sev-${sev})`
