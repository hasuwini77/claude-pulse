import type { CSSProperties } from 'react'
import { severity, SEVERITY_CSS } from '../utils/severity'

interface RingGaugeProps {
  label: string
  utilization: number | null
  size?: 'lg' | 'md'
}

const SIZE = { lg: 220, md: 160 }
const RADIUS = { lg: 86, md: 62 }
const STROKE = { lg: 13, md: 10 }
const FONT_BIG = { lg: 52, md: 38 }
const FONT_LABEL = { lg: 13, md: 11 }

export function RingGauge({ label, utilization, size = 'lg' }: RingGaugeProps) {
  const dim = SIZE[size]
  const r = RADIUS[size]
  const sw = STROKE[size]
  const cx = dim / 2
  const cy = dim / 2

  const circ = 2 * Math.PI * r
  const util = utilization ?? 0
  const fillPct = Math.min(100, Math.max(0, util))
  const offset = circ - (fillPct / 100) * circ
  const sev = severity(utilization)
  const fillColor = utilization == null ? 'var(--text-faint)' : SEVERITY_CSS[sev]

  const arcStyle: CSSProperties = {
    ['--ring-full' as string]: `${circ}`,
    ['--ring-offset' as string]: `${offset}`,
    strokeDasharray: circ,
    strokeDashoffset: circ, // starts at full — animation handles end state
  }

  return (
    <div
      className="flex flex-col items-center"
      role="figure"
      aria-label={`${label}: ${utilization != null ? `${utilization}%` : 'unavailable'}`}
    >
      <svg
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
        aria-hidden="true"
        className="overflow-visible"
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--track)"
          strokeWidth={sw}
        />
        {/* Fill arc — rotated so 0% is at top */}
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            className="ring-arc"
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={fillColor}
            strokeWidth={sw}
            strokeLinecap="round"
            style={arcStyle}
          />
        </g>
        {/* Center metric */}
        <text
          x={cx}
          y={cy + FONT_BIG[size] * 0.36}
          textAnchor="middle"
          className="font-display"
          fontSize={FONT_BIG[size]}
          fontWeight={700}
          fill={utilization == null ? 'var(--text-faint)' : 'var(--text-prime)'}
        >
          {utilization != null ? `${Math.round(utilization)}` : '—'}
        </text>
        {utilization != null && (
          <text
            x={cx + FONT_BIG[size] * 0.57}
            y={cy + FONT_BIG[size] * 0.36}
            className="font-display"
            fontSize={FONT_LABEL[size] + 2}
            fontWeight={500}
            fill="var(--text-muted)"
          >
            %
          </text>
        )}
      </svg>
      <span
        className="font-condensed font-semibold tracking-[0.12em] uppercase mt-1"
        style={{ fontSize: 11, color: 'var(--text-muted)' }}
      >
        {label}
      </span>
    </div>
  )
}
