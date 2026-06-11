/** Format a reset countdown as "Xd Yh", "Yh Zm", or "< 1m" */
export function formatCountdown(resetsAt: string | null, nowIso: string): string {
  if (!resetsAt) return '—'
  const now = new Date(nowIso).getTime()
  const end = new Date(resetsAt).getTime()
  let ms = end - now
  if (ms <= 0) return 'now'
  const totalSecs = Math.floor(ms / 1000)
  const days = Math.floor(totalSecs / 86400)
  const hours = Math.floor((totalSecs % 86400) / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m`
  return '< 1m'
}

/** Format a UTC ISO string as "HH:MM UTC" */
export function formatFetchedAt(iso: string): string {
  try {
    const d = new Date(iso)
    const hh = d.getUTCHours().toString().padStart(2, '0')
    const mm = d.getUTCMinutes().toString().padStart(2, '0')
    return `${hh}:${mm} UTC`
  } catch {
    return iso
  }
}

/** Format a number as "€X" or "€X.XX" */
export function formatCredits(n: number, currency: string): string {
  const sym = currency === 'EUR' ? '€' : currency
  return `${sym}${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`
}

/** How stale: returns minutes since fetchedAt */
export function minutesSince(fetchedAt: string, nowIso: string): number {
  const diff = new Date(nowIso).getTime() - new Date(fetchedAt).getTime()
  return Math.floor(diff / 60000)
}
