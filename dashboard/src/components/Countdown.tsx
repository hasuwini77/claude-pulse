import { severity, SEVERITY_CLASS } from '../utils/severity'
import { formatCountdown } from '../utils/format'

interface CountdownProps {
  resetsAt: string | null
  utilization: number | null
  now: string
  label?: string
}

export function Countdown({ resetsAt, utilization, now, label = 'resets in' }: CountdownProps) {
  const sev = severity(utilization)
  const time = formatCountdown(resetsAt, now)

  return (
    <div className="flex items-center gap-2">
      {/* Refresh icon */}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M13.5 2.5A7 7 0 1 0 14.9 8.5"
          stroke="var(--text-faint)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <polyline
          points="15,5 15,2 12,2"
          stroke="var(--text-faint)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="font-condensed"
        style={{ fontSize: 13, color: 'var(--text-faint)' }}
      >
        {label}
      </span>
      <span
        className={`font-condensed font-medium tabular-nums ${SEVERITY_CLASS[sev]}`}
        style={{ fontSize: 13 }}
      >
        {time}
      </span>
    </div>
  )
}
