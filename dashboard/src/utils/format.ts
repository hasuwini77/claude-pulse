/** "2D 6H" / "6H 30M" / "< 1M" */
export function formatCountdown(resetsAt: string | null, nowIso: string): string {
  if (!resetsAt) return '—'
  const ms = new Date(resetsAt).getTime() - new Date(nowIso).getTime()
  if (ms <= 0) return 'NOW'
  const secs = Math.floor(ms / 1000)
  const days  = Math.floor(secs / 86400)
  const hours = Math.floor((secs % 86400) / 3600)
  const mins  = Math.floor((secs % 3600) / 60)
  if (days > 0)  return `${days}D ${hours}H`
  if (hours > 0) return `${hours}H ${mins}M`
  if (mins > 0)  return `${mins}M`
  return '< 1M'
}

/** "updated 2m ago" / "updated 1h ago" */
export function relativeTime(fetchedAt: string, nowIso: string): string {
  const mins = Math.floor(
    (new Date(nowIso).getTime() - new Date(fetchedAt).getTime()) / 60000,
  )
  if (mins < 1)  return 'just now'
  if (mins === 1) return '1m ago'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h === 1)   return '1h ago'
  if (h < 24)    return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** "HH:MM UTC" */
export function formatUTC(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')} UTC`
  } catch { return iso }
}

/** "€0" / "€17,000" (no decimals for whole numbers) */
export function formatCredits(n: number, currency: string): string {
  const sym = currency === 'EUR' ? '€' : currency
  return `${sym}${n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)}`
}

/** Minutes since fetchedAt */
export function minutesSince(fetchedAt: string, nowIso: string): number {
  return Math.floor(
    (new Date(nowIso).getTime() - new Date(fetchedAt).getTime()) / 60000,
  )
}
