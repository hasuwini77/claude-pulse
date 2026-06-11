import type { ExtraUsage } from '../types'
import { formatCredits } from '../utils/format'

interface CreditMeterProps {
  data: ExtraUsage
}

export function CreditMeter({ data }: CreditMeterProps) {
  const { monthly_limit, used_credits, currency, enabled } = data
  const pct = monthly_limit > 0 ? Math.min(100, (used_credits / monthly_limit) * 100) : 0
  const usedFmt = formatCredits(used_credits, currency)
  const limitFmt = formatCredits(monthly_limit, currency)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span
          className="font-condensed font-semibold tracking-[0.12em] uppercase"
          style={{ fontSize: 10, color: 'var(--text-faint)' }}
        >
          Extra Usage
        </span>
        {!enabled && (
          <span
            className="font-condensed"
            style={{ fontSize: 11, color: 'var(--text-faint)' }}
          >
            disabled
          </span>
        )}
      </div>

      {/* Bar track */}
      <div
        className="w-full rounded-sm overflow-hidden"
        style={{ height: 3, background: 'var(--track)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Extra usage: ${usedFmt} of ${limitFmt}`}
      >
        <div
          className="h-full transition-all duration-1000 ease-out"
          style={{
            width: `${pct}%`,
            background: pct > 80 ? 'var(--crit)' : pct > 50 ? 'var(--warn)' : 'var(--ok)',
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1.5">
        <span
          className="font-condensed font-medium tabular-nums"
          style={{ fontSize: 12, color: 'var(--text-prime)' }}
        >
          {usedFmt}
        </span>
        <span
          className="font-condensed tabular-nums"
          style={{ fontSize: 12, color: 'var(--text-muted)' }}
        >
          {limitFmt}
        </span>
      </div>
    </div>
  )
}
