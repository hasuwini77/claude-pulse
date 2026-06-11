import type { UsageWindow } from '../types'
import { severity, STATUS, sevColor } from '../utils/severity'
import { formatCountdown } from '../utils/format'

interface ModelRowProps {
  name:  string
  data:  UsageWindow | null
  now:   string
  isStale?: boolean
}

// The linear bar uses the same redline-zone language as the dial gauges
const ZONES: Array<{ pct: number; color: string }> = [
  { pct: 60, color: 'var(--zone-ok)'   },
  { pct: 85, color: 'var(--zone-warn)' },
  { pct: 100, color: 'var(--zone-crit)' },
]

export function ModelRow({ name, data, now, isStale }: ModelRowProps) {
  const util      = data?.utilization ?? null
  const hasValue  = util != null
  const sev       = severity(util)
  const color     = hasValue ? sevColor(sev) : 'var(--text-dim)'
  const pct       = hasValue ? Math.min(100, Math.max(0, util)) : 0
  const countdown = (hasValue && data?.resets_at)
    ? formatCountdown(data.resets_at, now)
    : null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 1fr auto',
        alignItems: 'center',
        gap: 10,
        filter: isStale ? 'saturate(0.45)' : undefined,
      }}
    >
      {/* Name */}
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}>
        {name}
      </span>

      {/* Bar + zone track */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div
          style={{
            position: 'relative',
            height: 4,
            background: 'var(--surface-raised)',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid var(--hairline)',
          }}
          aria-hidden="true"
        >
          {/* Zone track bands (ghosted, behind fill) */}
          {hasValue && ZONES.map(({ pct: end, color: zc }, i) => {
            const start = i === 0 ? 0 : ZONES[i - 1].pct
            return (
              <div
                key={end}
                style={{
                  position: 'absolute',
                  left: `${start}%`,
                  width: `${end - start}%`,
                  height: '100%',
                  background: zc,
                }}
              />
            )
          })}
          {/* Live fill */}
          {hasValue && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: `${pct}%`,
                height: '100%',
                background: color,
                borderRadius: 2,
                transition: 'width 700ms ease-out',
                boxShadow: `0 0 6px ${color}`,
              }}
            />
          )}
          {/* Threshold tick lines */}
          {hasValue && [60, 85].map(t => (
            <div
              key={t}
              style={{
                position: 'absolute',
                left: `${t}%`,
                top: 0, bottom: 0,
                width: 1,
                background: 'var(--hairline)',
              }}
            />
          ))}
        </div>

        {/* Empty state for null model */}
        {!hasValue && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}>
            NO {name.toUpperCase()} USAGE THIS WEEK
          </span>
        )}
      </div>

      {/* Value + status + countdown */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        {hasValue ? (
          <>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text)',
            }}>
              {Math.round(util!)}%
            </span>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color,
            }}>
              {STATUS[sev]}
            </span>
            {countdown && (
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: 9,
                letterSpacing: '0.08em',
                color: 'var(--text-dim)',
              }}>
                ↻ {countdown}
              </span>
            )}
          </>
        ) : (
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-dim)',
          }}>
            —
          </span>
        )}
      </div>
    </div>
  )
}
