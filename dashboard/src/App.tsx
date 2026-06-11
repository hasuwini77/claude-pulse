import { useUsageData } from './hooks/useUsageData'
import { StatusBar } from './components/StatusBar'
import { RingGauge, RingGaugeSkeleton } from './components/RingGauge'
import { ModelRow } from './components/ModelRow'
import { CreditMeter } from './components/CreditMeter'
import { SparkLine } from './components/SparkLine'

// ── Skeleton page ────────────────────────────────────────────────────────
function SkeletonPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '28px 32px 48px' }}>
      {/* Masthead shimmer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 180, height: 20, borderRadius: 'var(--r-sm)', background: 'var(--surface-raised)' }} />
        <div className="skeleton" style={{ width: 100, height: 14, borderRadius: 'var(--r-sm)', background: 'var(--surface-raised)' }} />
      </div>
      <div style={{ height: 1, background: 'var(--hairline)', marginBottom: 32 }} />
      {/* Gauge row */}
      <div style={{ display: 'flex', gap: 24 }}>
        <RingGaugeSkeleton />
        <RingGaugeSkeleton />
        {/* Rail skeleton */}
        <div
          className="flex-1"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--rim), var(--panel)',
            padding: 'var(--space-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton" style={{ width: '100%', height: 16, borderRadius: 'var(--r-sm)', background: 'var(--surface-raised)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main app ─────────────────────────────────────────────────────────────
export default function App() {
  const { usage, history, state, now, refresh } = useUsageData()

  if (state === 'loading' && !usage) return <SkeletonPage />

  const u = usage          // may be non-null even on error (last-known)
  const isError = state === 'error'
  const isStale = state === 'stale'

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 1400,
    }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header style={{ padding: '28px 32px 0' }}>
        <div className="stagger-in" style={{ animationDelay: '0ms' }}>
          <StatusBar
            state={state}
            fetchedAt={u?.fetched_at ?? null}
            now={now}
            onRefresh={refresh}
          />
        </div>
        <div style={{ height: 1, background: 'var(--hairline)', margin: '20px 0 0' }} />
      </header>

      {/* ── Main content — grows to fill viewport ─────────────────────── */}
      <main style={{ flex: 1, padding: '28px 32px 0' }}>
        {/* Error banner — TELEMETRY OFFLINE */}
        {isError && (
          <div
            className="stagger-in"
            style={{
              animationDelay: '30ms',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
              padding: '8px 14px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--sev-crit)',
              background: 'oklch(0.34 0.07 22 / 0.18)',
            }}
          >
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx={8} cy={8} r={7} stroke="var(--sev-crit)" strokeWidth={1.5} />
              <line x1={8} y1={4} x2={8} y2={9} stroke="var(--sev-crit)" strokeWidth={1.5} strokeLinecap="round" />
              <circle cx={8} cy={12} r={1} fill="var(--sev-crit)" />
            </svg>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--sev-crit)',
            }}>
              Telemetry Offline
            </span>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}>
              {u ? '— showing last known values' : '— could not load snapshot'}
            </span>
          </div>
        )}

        {/* Gauge row: 5-HOUR | WEEKLY | Rail */}
        <div
          className="stagger-in"
          style={{
            animationDelay: '60ms',
            display: 'grid',
            gridTemplateColumns: '260px 260px 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* 5-HOUR gauge */}
          <RingGauge
            label="5-Hour"
            labelColor="var(--win-5h)"
            utilization={u?.five_hour.utilization ?? null}
            resetsAt={u?.five_hour.resets_at ?? null}
            now={now}
            isError={isError}
            isStale={isStale}
          />

          {/* WEEKLY gauge */}
          <RingGauge
            label="Weekly"
            labelColor="var(--win-wk)"
            utilization={u?.weekly.utilization ?? null}
            resetsAt={u?.weekly.resets_at ?? null}
            now={now}
            isError={isError}
            isStale={isStale}
          />

          {/* Right rail — per-model + credit meter */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--rim), var(--panel)',
              padding: 'var(--space-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-xl)',
            }}
          >
            {/* Per-model section header */}
            <div>
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 16,
              }}>
                Per Model · Weekly
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <ModelRow
                  name="Sonnet"
                  data={u?.weekly_sonnet ?? null}
                  now={now}
                  isStale={isStale}
                />
                <ModelRow
                  name="Opus"
                  data={u?.weekly_opus ?? null}
                  now={now}
                  isStale={isStale}
                />
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--hairline)' }} />

            {/* Extra usage credit meter */}
            {u?.extra_usage && <CreditMeter data={u.extra_usage} />}
          </div>
        </div>

        {/* Trend band: 7-day telemetry */}
        {history.length > 0 && (
          <div
            className="stagger-in"
            style={{
              animationDelay: '120ms',
              marginTop: 28,
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--rim), var(--panel)',
              padding: 'var(--space-xl)',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-body)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: 16,
            }}>
              7-Day Telemetry
            </div>
            <SparkLine data={history} />
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer>
        <div
          className="stagger-in"
          style={{
            animationDelay: '180ms',
            margin: '32px 32px 0',
            paddingTop: 14,
            paddingBottom: 32,
            borderTop: '1px solid var(--hairline)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            color: 'var(--text-dim)',
          }}>
            Refreshes every 5 min · data committed by scheduler
          </span>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            color: 'var(--text-dim)',
          }}>
            claude-pulse
          </span>
        </div>
      </footer>
    </div>
  )
}
