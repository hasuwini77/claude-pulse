import type { CSSProperties } from 'react'
import { severity, STATUS, sevColor } from '../utils/severity'
import { formatCountdown } from '../utils/format'

// ── Gauge geometry ───────────────────────────────────────────────────────
const R = 80
const C = 2 * Math.PI * R        // ≈ 502.65
const SWEEP = 0.75                // 270° sweep

/**
 * dasharray + dashoffset to draw an arc occupying [a%, b%] of the 270° sweep.
 * The SVG element is rotated -135° via CSS so the arc starts at lower-left.
 */
function dashFor(a: number, b: number): CSSProperties {
  return {
    strokeDasharray: `${C * SWEEP * ((b - a) / 100)} ${C}`,
    strokeDashoffset: `${-C * SWEEP * (a / 100)}`,
  }
}

/** Position of a point on the arc at `pct` % of the 270° sweep */
function arcPoint(pct: number, r: number) {
  const angle = (pct / 100) * 270 * (Math.PI / 180)
  return {
    x: 100 + r * Math.cos(angle),
    y: 100 + r * Math.sin(angle),
  }
}

const ZONES: Array<[number, number, string]> = [
  [0,  60, 'var(--zone-ok)'],
  [60, 85, 'var(--zone-warn)'],
  [85, 100,'var(--zone-crit)'],
]

const THRESHOLDS = [
  { pct: 60, label: '60' },
  { pct: 85, label: '85' },
]

// ── Skeleton (loading placeholder) ──────────────────────────────────────
export function RingGaugeSkeleton() {
  return (
    <figure
      className="relative grid place-items-center rounded-md border"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--hairline)',
        boxShadow: 'var(--rim), var(--panel)',
        padding: 'var(--space-xl)',
        width: 260, height: 300,
      }}
      aria-hidden="true"
    >
      <div className="relative grid place-items-center">
        <svg viewBox="0 0 200 200" width={200} height={200}
          style={{ transform: 'rotate(-135deg)' }}>
          {/* Full ghosted ring */}
          <circle cx={100} cy={100} r={R} fill="none"
            stroke="var(--surface-raised)" strokeWidth={10}
            strokeLinecap="butt"
            style={{ ...dashFor(0, 100) }}
            className="skeleton" />
        </svg>
        {/* Shimmer blocks for text */}
        <div className="absolute grid place-items-center gap-2 text-center">
          <div className="skeleton rounded" style={{ width: 48, height: 12, background: 'var(--surface-raised)' }} />
          <div className="skeleton rounded" style={{ width: 80, height: 52, background: 'var(--surface-raised)' }} />
          <div className="skeleton rounded" style={{ width: 56, height: 12, background: 'var(--surface-raised)' }} />
          <div className="skeleton rounded" style={{ width: 96, height: 11, background: 'var(--surface-raised)' }} />
        </div>
      </div>
    </figure>
  )
}

// ── Main gauge ───────────────────────────────────────────────────────────
interface RingGaugeProps {
  label:      string
  utilization: number | null
  resetsAt:   string | null
  now:        string
  isError?:   boolean
  isStale?:   boolean
}

export function RingGauge({ label, utilization, resetsAt, now, isError, isStale }: RingGaugeProps) {
  const util = utilization ?? 0
  const sev  = severity(utilization)
  const fill = sevColor(sev)
  const countdown = formatCountdown(resetsAt, now)
  const hasValue  = utilization != null

  return (
    <figure
      role="meter"
      aria-valuenow={hasValue ? util : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label} usage${hasValue ? ` ${Math.round(util)} percent, ${STATUS[sev].toLowerCase()}` : ', unavailable'}`}
      className="relative grid place-items-center rounded-md border"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--hairline)',
        boxShadow: 'var(--rim), var(--panel)',
        padding: 'var(--space-xl)',
        width: 260,
        // Apply stale desaturation to the entire figure
        filter: isStale ? 'saturate(0.45)' : undefined,
      }}
    >
      {/* SVG rotated -135° so arc starts at lower-left */}
      <svg
        viewBox="0 0 200 200"
        width={200}
        height={200}
        aria-hidden="true"
        style={{ transform: 'rotate(-135deg)' }}
      >
        {/* Ghosted redline zone tracks */}
        {ZONES.map(([a, b, c]) => (
          <circle
            key={a}
            cx={100} cy={100} r={R}
            fill="none"
            stroke={c}
            strokeWidth={10}
            strokeLinecap="butt"
            style={dashFor(a, b) as CSSProperties}
          />
        ))}

        {/* Threshold ticks at 60% and 85% */}
        {THRESHOLDS.map(({ pct, label: tickLabel }) => {
          const inner = arcPoint(pct, R - 7)
          const outer = arcPoint(pct, R + 7)
          const lp    = arcPoint(pct, R + 18)
          return (
            <g key={pct}>
              <line
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="var(--hairline)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              <text
                x={lp.x} y={lp.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fill="var(--text-dim)"
                fontFamily="var(--font-body)"
                fontWeight={500}
                letterSpacing="0.06em"
                /* counter-rotate so label stays readable */
                transform={`rotate(135 ${lp.x} ${lp.y})`}
              >
                {tickLabel}
              </text>
            </g>
          )
        })}

        {/* Live arc — fills to current value */}
        {hasValue && (
          <circle
            cx={100} cy={100} r={R}
            fill="none"
            stroke={fill}
            strokeWidth={10}
            strokeLinecap="round"
            style={{
              ...dashFor(0, Math.min(100, Math.max(0, util))) as CSSProperties,
              filter: `drop-shadow(0 0 10px ${fill})`,
              transition: 'stroke-dasharray .72s cubic-bezier(.16,1,.3,1)',
            }}
          />
        )}

        {/* Null / unavailable: dim full ring instead */}
        {!hasValue && (
          <circle
            cx={100} cy={100} r={R}
            fill="none"
            stroke="var(--surface-raised)"
            strokeWidth={10}
            strokeLinecap="butt"
            style={dashFor(0, 100) as CSSProperties}
          />
        )}
      </svg>

      {/* Center stack — absolute, upright, no rotation */}
      <figcaption
        className="absolute grid place-items-center text-center"
        style={{ gap: 2 }}
      >
        {/* Section label */}
        <span
          className="font-body uppercase"
          style={{
            fontSize: 11,
            letterSpacing: '0.10em',
            fontWeight: 500,
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>

        {/* Hero numeral */}
        <span
          className="font-display tabular-nums leading-none"
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: hasValue ? 'var(--text)' : 'var(--text-dim)',
          }}
        >
          {hasValue ? `${Math.round(util)}` : '—'}
          {hasValue && (
            <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-muted)' }}>%</span>
          )}
        </span>

        {/* Status word */}
        <span
          className="font-body uppercase"
          style={{
            fontSize: 11,
            letterSpacing: '0.10em',
            fontWeight: 600,
            color: hasValue ? fill : 'var(--text-dim)',
          }}
        >
          {hasValue ? STATUS[sev] : 'NO DATA'}
        </span>

        {/* Countdown caption */}
        <span
          className="font-body uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--text-dim)',
            marginTop: 2,
          }}
        >
          RESETS IN {countdown}
        </span>
      </figcaption>

      {/* Hazard hatch overlay — error state only, never blank the dials */}
      {isError && (
        <div
          className="hazard-hatch absolute inset-0 rounded-md"
          aria-hidden="true"
        />
      )}
    </figure>
  )
}
