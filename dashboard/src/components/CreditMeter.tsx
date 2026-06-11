import type { ExtraUsage } from '../types'
import { formatCredits } from '../utils/format'

interface CreditMeterProps {
  data: ExtraUsage
}

export function CreditMeter({ data }: CreditMeterProps) {
  const { monthly_limit, used_credits, currency, enabled } = data
  const pct = monthly_limit > 0
    ? Math.min(100, (used_credits / monthly_limit) * 100)
    : 0
  const usedFmt  = formatCredits(used_credits, currency)
  const limitFmt = formatCredits(monthly_limit, currency)

  return (
    <div style={{ opacity: enabled ? 1 : 0.42 }}>
      {/* Label row */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
        }}>
          {enabled ? 'Extra Usage Credit' : 'Extra Usage Off'}
        </span>
        {enabled && (
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-muted)',
          }}>
            {usedFmt} / {limitFmt}
          </span>
        )}
      </div>

      {/* Bar track — ice accent fill (NOT severity colors; credit is a different axis) */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Extra usage: ${usedFmt} of ${limitFmt}`}
        style={{
          height: 3,
          background: 'var(--surface-raised)',
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid var(--hairline)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: enabled ? 'var(--accent)' : 'var(--text-dim)',
            borderRadius: 2,
            transition: 'width 800ms ease-out',
          }}
        />
      </div>
    </div>
  )
}
