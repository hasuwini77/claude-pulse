import type { HistoryPoint } from '../types'
import { severity, SEVERITY_CSS } from '../utils/severity'

interface SparkLineProps {
  data: HistoryPoint[]
  metric: 'five_hour' | 'weekly'
  width?: number
  height?: number
  label?: string
}

function buildPolyline(pts: Array<{x: number; y: number}>): string {
  return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

export function SparkLine({
  data,
  metric,
  width = 320,
  height = 56,
  label,
}: SparkLineProps) {
  if (!data.length) {
    return (
      <div
        className="font-condensed"
        style={{ fontSize: 12, color: 'var(--text-faint)', height }}
      >
        no history
      </div>
    )
  }

  const pad = { t: 8, b: 18, l: 4, r: 4 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b

  const values = data.map(d => d[metric])
  const minV = 0
  const maxV = Math.max(100, ...values)

  const pts = data.map((d, i) => ({
    x: pad.l + (i / Math.max(1, data.length - 1)) * W,
    y: pad.t + H - ((d[metric] - minV) / (maxV - minV)) * H,
    v: d[metric],
    t: d.t,
  }))

  // Area fill path (closed polygon)
  const areaPath =
    `M ${pts[0].x},${pad.t + H} ` +
    pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L ${pts[pts.length - 1].x},${pad.t + H} Z`

  // Severity color of the last point
  const lastVal = values[values.length - 1]
  const sev = severity(lastVal)
  const strokeColor = SEVERITY_CSS[sev]

  // Day tick marks under the chart
  const days = new Map<string, number>()
  data.forEach((d, i) => {
    const day = d.t.slice(0, 10) // YYYY-MM-DD
    if (!days.has(day)) days.set(day, pts[i].x)
  })

  return (
    <div>
      {label && (
        <div
          className="font-condensed font-semibold tracking-[0.12em] uppercase mb-2"
          style={{ fontSize: 10, color: 'var(--text-faint)' }}
        >
          {label}
        </div>
      )}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-label={`${metric} usage history over 7 days`}
        role="img"
      >
        {/* Area fill */}
        <path
          d={areaPath}
          fill={strokeColor}
          opacity={0.08}
        />
        {/* Main line */}
        <polyline
          className="spark-line"
          points={buildPolyline(pts)}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeDasharray: 1000, strokeDashoffset: 1000 }}
        />
        {/* Last point dot */}
        <circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r={3}
          fill={strokeColor}
        />
        {/* Day tick marks */}
        {Array.from(days.entries()).map(([day, x]) => (
          <g key={day}>
            <line
              x1={x}
              y1={pad.t + H + 4}
              x2={x}
              y2={pad.t + H + 6}
              stroke="var(--text-faint)"
              strokeWidth={1}
            />
            <text
              x={x}
              y={height - 2}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-faint)"
              className="font-condensed"
            >
              {day.slice(5)} {/* MM-DD */}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
