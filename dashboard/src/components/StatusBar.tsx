import type { DataState } from '../types'
import { relativeTime } from '../utils/format'

interface StatusBarProps {
  state:     DataState
  fetchedAt: string | null
  now:       string
  onRefresh: () => void
}

const STATE_META: Record<DataState, {
  label: string
  color: string
  pulse: boolean
}> = {
  loading: { label: 'ACQUIRING', color: 'var(--text-dim)',  pulse: true  },
  fresh:   { label: 'LIVE',      color: 'var(--sev-ok)',   pulse: true  },
  stale:   { label: 'STALE',     color: 'var(--sev-warn)', pulse: false },
  error:   { label: 'SIGNAL LOST', color: 'var(--sev-crit)', pulse: false },
}

export function StatusBar({ state, fetchedAt, now, onRefresh }: StatusBarProps) {
  const meta = STATE_META[state]
  const age  = fetchedAt && state !== 'loading'
    ? relativeTime(fetchedAt, now)
    : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* Wordmark — left-anchored */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Triangle/upward chevron mark */}
        <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2.5L17.5 17.5H2.5L10 2.5Z"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <path
            d="M7 13.5L10 7.5L13 13.5"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'var(--text)',
          textTransform: 'uppercase',
        }}>
          Claude·Pulse
        </span>
      </div>

      {/* Status cluster — right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Updated-ago */}
        {age && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--text-dim)',
            letterSpacing: '0.04em',
          }}>
            updated {age}
          </span>
        )}

        {/* State badge: dot + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            className={meta.pulse ? 'dot-pulse' : ''}
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: meta.color,
              flexShrink: 0,
            }}
          />
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: meta.color,
          }}>
            {meta.label}
          </span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          aria-label="Refresh data"
          title="Refresh"
          style={{
            background: 'none',
            border: 'none',
            padding: 4,
            color: 'var(--text-dim)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13.5 2.5A7 7 0 1 0 14.9 8.5"
              stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            <polyline points="15,5 15,2 12,2"
              stroke="currentColor" strokeWidth={1.5}
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
