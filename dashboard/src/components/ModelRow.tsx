import type { UsageWindow } from '../types'
import { severity, SEVERITY_CSS } from '../utils/severity'
import { formatCountdown } from '../utils/format'

interface ModelRowProps {
  name: string
  data: UsageWindow | null
  now: string
}

export function ModelRow({ name, data, now }: ModelRowProps) {
  const util = data?.utilization ?? null
  const sev = severity(util)
  const color = util != null ? SEVERITY_CSS[sev] : 'var(--text-faint)'
  const pct = util != null ? Math.min(100, Math.max(0, util)) : 0
  const countdown = data?.resets_at ? formatCountdown(data.resets_at, now) : null
  const isNull = util == null

  return (
    <div className="flex items-center gap-4">
      {/* Model name */}
      <span
        className="font-condensed font-medium w-16 shrink-0 tracking-[0.05em] uppercase"
        style={{ fontSize: 12, color: 'var(--text-muted)' }}
      >
        {name}
      </span>

      {/* Bar track */}
      <div className="flex-1 relative" style={{ height: 2, background: 'var(--track)' }}>
        {!isNull && (
          <div
            className="absolute inset-y-0 left-0 transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: color }}
          />
        )}
      </div>

      {/* Percent */}
      <span
        className="font-condensed font-medium tabular-nums w-10 text-right shrink-0"
        style={{ fontSize: 13, color: isNull ? 'var(--text-faint)' : 'var(--text-prime)' }}
      >
        {isNull ? 'N/A' : `${Math.round(util!)}%`}
      </span>

      {/* Countdown */}
      {!isNull && countdown && (
        <span
          className="font-condensed tabular-nums w-14 text-right shrink-0"
          style={{ fontSize: 11, color }}
        >
          ↻ {countdown}
        </span>
      )}
      {(isNull || !countdown) && (
        <span className="w-14 shrink-0" />
      )}
    </div>
  )
}
