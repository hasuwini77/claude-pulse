import { useRef, useState } from 'react'
import type { HistoryPoint } from '../types'

interface SparkLineProps {
  data:   HistoryPoint[]
  width?: number
  height?: number
}

const PAD = { t: 8, b: 24, l: 8, r: 16 }
const MIN_Y = 0
const MAX_Y = 100
const THRESHOLD = [
  { y: 60, label: '60', color: 'var(--zone-warn)' },
  { y: 85, label: '85', color: 'var(--zone-crit)' },
]

function toSVGPoints(data: HistoryPoint[], key: 'five_hour' | 'weekly', W: number, H: number) {
  if (data.length === 0) return []
  const total = data.length
  return data.reduce<Array<{ x: number; y: number; v: number; t: string }>>((acc, d, i) => {
    const v = d[key]
    if (v == null) return acc   // skip null windows — don't NaN the polyline
    acc.push({
      x: PAD.l + (i / Math.max(1, total - 1)) * W,
      y: PAD.t + H - ((v - MIN_Y) / (MAX_Y - MIN_Y)) * H,
      v,
      t: d.t,
    })
    return acc
  }, [])
}

function pts2poly(points: Array<{ x: number; y: number }>) {
  return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

function buildArea(
  points: Array<{ x: number; y: number }>,
  H: number,
): string {
  if (points.length === 0) return ''
  const line = points.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return `M ${points[0].x},${PAD.t + H} ${line} L ${points[points.length - 1].x},${PAD.t + H} Z`
}

export function SparkLine({ data, width = 900, height = 88 }: SparkLineProps) {
  const W = width - PAD.l - PAD.r
  const H = height - PAD.t - PAD.b

  const [tooltip, setTooltip] = useState<{
    x: number; y: number; pt: HistoryPoint
  } | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)

  const wkPts   = toSVGPoints(data, 'weekly',    W, H)
  const fhPts   = toSVGPoints(data, 'five_hour', W, H)

  // Series identity by window hue (matches the gauges + statusline), so the two
  // lines and the legend are distinguishable. Severity is read from the 60/85 gridlines.
  const fhColor = 'var(--win-5h)' // pink
  const wkColor = 'var(--win-wk)' // lavender

  // Day tick labels
  const days = new Map<string, number>()
  data.forEach((d, i) => {
    const day = d.t.slice(0, 10)
    if (!days.has(day)) days.set(day, wkPts[i]?.x ?? 0)
  })

  if (data.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-dim)', height }}>
        no history
      </div>
    )
  }

  const yFor = (val: number) => PAD.t + H - ((val - MIN_Y) / (MAX_Y - MIN_Y)) * H

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    if (!data.length) return
    const idx  = Math.round(((mx - PAD.l) / W) * (data.length - 1))
    const clamped = Math.max(0, Math.min(data.length - 1, idx))
    const pt = data[clamped]
    const x  = wkPts[clamped]?.x ?? PAD.l
    const y  = Math.min(wkPts[clamped]?.y ?? PAD.t, fhPts[clamped]?.y ?? PAD.t)
    setTooltip({ x, y, pt })
  }

  return (
    <div className="relative" style={{ width, userSelect: 'none' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="7-day usage history — 5-hour and weekly utilization"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        style={{ cursor: 'crosshair', display: 'block' }}
      >
        {/* Threshold gridlines */}
        {THRESHOLD.map(({ y, label, color }) => {
          const gy = yFor(y)
          return (
            <g key={y}>
              <line
                x1={PAD.l} y1={gy}
                x2={PAD.l + W} y2={gy}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={PAD.l + W + 4}
                y={gy}
                dominantBaseline="central"
                fontSize={9}
                fill="var(--text-dim)"
                fontFamily="var(--font-body)"
                fontWeight={500}
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* Day tick marks */}
        {Array.from(days.entries()).map(([day, x]) => (
          <g key={day}>
            <line
              x1={x} y1={PAD.t + H + 4}
              x2={x} y2={PAD.t + H + 7}
              stroke="var(--hairline)"
              strokeWidth={1}
            />
            <text
              x={x}
              y={height - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-dim)"
              fontFamily="var(--font-body)"
            >
              {day.slice(5)}
            </text>
          </g>
        ))}

        {/* Weekly — soft filled area (slow trend) */}
        <path
          d={buildArea(wkPts, H)}
          fill={wkColor}
          opacity={0.10}
        />
        <polyline
          points={pts2poly(wkPts)}
          fill="none"
          stroke={wkColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.70}
        />

        {/* 5-hour — crisper line (volatile) */}
        <polyline
          points={pts2poly(fhPts)}
          fill="none"
          stroke={fhColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Last-point emphasis dots */}
        {wkPts.length > 0 && (
          <circle
            cx={wkPts[wkPts.length - 1].x}
            cy={wkPts[wkPts.length - 1].y}
            r={3.5}
            fill={wkColor}
            style={{ filter: `drop-shadow(0 0 5px ${wkColor})` }}
          />
        )}
        {fhPts.length > 0 && (
          <circle
            cx={fhPts[fhPts.length - 1].x}
            cy={fhPts[fhPts.length - 1].y}
            r={3.5}
            fill={fhColor}
            style={{ filter: `drop-shadow(0 0 5px ${fhColor})` }}
          />
        )}

        {/* Hover crosshair */}
        {tooltip && (
          <line
            x1={tooltip.x} y1={PAD.t}
            x2={tooltip.x} y2={PAD.t + H}
            stroke="var(--hairline)"
            strokeWidth={1}
            strokeDasharray="2 2"
            pointerEvents="none"
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(tooltip.x + 8, width - 140),
            top: Math.max(4, tooltip.y - 40),
            background: 'var(--surface-raised)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-sm)',
            padding: '5px 9px',
            pointerEvents: 'none',
            boxShadow: 'var(--panel)',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            color: 'var(--text-dim)',
            letterSpacing: '0.06em',
            marginBottom: 3,
          }}>
            {new Date(tooltip.pt.t).toLocaleString(undefined, {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              fontWeight: 600,
              color: fhColor,
              fontVariantNumeric: 'tabular-nums',
            }}>
              5H {tooltip.pt.five_hour != null ? `${Math.round(tooltip.pt.five_hour)}%` : '—'}
            </span>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              fontWeight: 600,
              color: wkColor,
              fontVariantNumeric: 'tabular-nums',
            }}>
              WK {tooltip.pt.weekly != null ? `${Math.round(tooltip.pt.weekly)}%` : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginTop: 2,
        paddingLeft: PAD.l,
      }}>
        {([
          { label: '5-HOUR', color: fhColor, bold: true },
          { label: 'WEEKLY', color: wkColor, bold: false },
        ] as const).map(({ label, color, bold }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width={16} height={2} viewBox="0 0 16 2" aria-hidden="true">
              <line x1={0} y1={1} x2={16} y2={1}
                stroke={color} strokeWidth={bold ? 2 : 1.5} />
            </svg>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.10em',
              color: 'var(--text-dim)',
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
