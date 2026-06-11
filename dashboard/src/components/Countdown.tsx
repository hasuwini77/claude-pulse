import { severity, sevColor } from '../utils/severity'
import { formatCountdown } from '../utils/format'

interface CountdownProps {
  resetsAt: string | null
  utilization: number | null
  now: string
  label?: string
}

/** Standalone countdown — kept for possible external use; gauges embed the countdown directly. */
export function Countdown({ resetsAt, utilization, now, label = 'resets in' }: CountdownProps) {
  const sev   = severity(utilization)
  const color = sevColor(sev)
  const time  = formatCountdown(resetsAt, now)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-dim)' }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 12,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color,
      }}>
        {time}
      </span>
    </div>
  )
}
