import type { DataState } from '../types'
import { formatFetchedAt } from '../utils/format'

interface StatusBarProps {
  state: DataState
  fetchedAt: string | null
  onRefresh: () => void
}

const STATE_META: Record<DataState, { label: string; color: string; pulse: boolean }> = {
  loading: { label: 'LOADING',  color: 'var(--text-faint)', pulse: true  },
  fresh:   { label: 'LIVE',     color: 'var(--ok)',         pulse: false },
  stale:   { label: 'STALE',    color: 'var(--warn)',       pulse: false },
  error:   { label: 'ERROR',    color: 'var(--crit)',       pulse: false },
}

export function StatusBar({ state, fetchedAt, onRefresh }: StatusBarProps) {
  const meta = STATE_META[state]

  return (
    <div className="flex items-center justify-between w-full">
      {/* Logo / title */}
      <div className="flex items-center gap-3">
        {/* Anthropic "A" glyph — simple SVG mark */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3L20.5 20H3.5L12 3Z"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M8.5 15L12 8L15.5 15"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="font-display font-semibold tracking-[0.08em] uppercase"
          style={{ fontSize: 18, letterSpacing: '0.1em' }}
        >
          Claude Pulse
        </span>
      </div>

      {/* Status cluster */}
      <div className="flex items-center gap-4">
        {fetchedAt && state !== 'loading' && (
          <span
            className="font-condensed tabular-nums"
            style={{ fontSize: 12, color: 'var(--text-faint)' }}
          >
            {formatFetchedAt(fetchedAt)}
          </span>
        )}

        {/* State badge */}
        <div className="flex items-center gap-1.5">
          <span
            className={meta.pulse ? 'dot-pulse' : ''}
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: meta.color,
            }}
          />
          <span
            className="font-condensed font-semibold tracking-[0.12em]"
            style={{ fontSize: 10, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 4, color: 'var(--text-faint)' }}
          aria-label="Refresh data"
          title="Refresh"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M13.5 2.5A7 7 0 1 0 14.9 8.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <polyline
              points="15,5 15,2 12,2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
