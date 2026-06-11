import { useUsageData } from './hooks/useUsageData'
import { StatusBar } from './components/StatusBar'
import { RingGauge } from './components/RingGauge'
import { Countdown } from './components/Countdown'
import { ModelRow } from './components/ModelRow'
import { CreditMeter } from './components/CreditMeter'
import { SparkLine } from './components/SparkLine'

function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="h-px flex-1" style={{ background: 'var(--border-faint)' }} />
      {label && (
        <span
          className="font-condensed font-semibold tracking-[0.16em] uppercase shrink-0"
          style={{ fontSize: 9, color: 'var(--text-faint)' }}
        >
          {label}
        </span>
      )}
      <div className="h-px flex-1" style={{ background: 'var(--border-faint)' }} />
    </div>
  )
}

function LoadingScreen() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Simple animated ring */}
        <svg width={64} height={64} viewBox="0 0 64 64" aria-label="Loading">
          <circle
            cx={32} cy={32} r={24}
            fill="none"
            stroke="var(--track)"
            strokeWidth={4}
          />
          <circle
            cx={32} cy={32} r={24}
            fill="none"
            stroke="var(--ok)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="40 112"
            style={{
              transformOrigin: '50% 50%',
              animation: 'spin 1.2s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </svg>
        <span
          className="font-condensed tracking-[0.14em] uppercase"
          style={{ fontSize: 11, color: 'var(--text-faint)' }}
        >
          Reading snapshot
        </span>
      </div>
    </div>
  )
}

function ErrorScreen({ message }: { message?: string }) {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="flex flex-col items-center gap-3 max-w-sm text-center">
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx={12} cy={12} r={10} stroke="var(--crit)" strokeWidth={1.5} />
          <line x1={12} y1={7} x2={12} y2={13} stroke="var(--crit)" strokeWidth={1.5} strokeLinecap="round" />
          <circle cx={12} cy={17} r={1} fill="var(--crit)" />
        </svg>
        <span
          className="font-condensed font-medium"
          style={{ fontSize: 13, color: 'var(--text-prime)' }}
        >
          Failed to load snapshot
        </span>
        {message && (
          <span
            className="font-condensed"
            style={{ fontSize: 11, color: 'var(--text-muted)' }}
          >
            {message}
          </span>
        )}
        <span
          className="font-condensed"
          style={{ fontSize: 11, color: 'var(--text-faint)' }}
        >
          Is the scheduler running? Is the repo up to date?
        </span>
      </div>
    </div>
  )
}

export default function App() {
  const { usage, history, state, now, refresh } = useUsageData()

  if (state === 'loading' && !usage) return <LoadingScreen />
  if (state === 'error' && !usage) return <ErrorScreen />
  if (state === 'error' && usage?.error) return <ErrorScreen message={usage.error} />

  // Guaranteed non-null past the guards above
  const u = usage!

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        paddingLeft: 48,
        paddingRight: 48,
        paddingTop: 28,
        paddingBottom: 48,
      }}
    >
      {/* Header */}
      <StatusBar
        state={state}
        fetchedAt={u.fetched_at}
        onRefresh={refresh}
      />

      {/* Horizontal rule */}
      <div
        className="w-full mt-6"
        style={{ height: 1, background: 'var(--border-faint)' }}
      />

      {/* Main grid: 3 columns */}
      <div
        className="mt-8 grid gap-0"
        style={{
          gridTemplateColumns: '1fr 1fr 340px',
          gridTemplateRows: 'auto auto',
          columnGap: 0,
        }}
      >
        {/* ── 5-HOUR column ── */}
        <div
          className="flex flex-col items-center py-8"
          style={{ borderRight: '1px solid var(--border-faint)' }}
        >
          <RingGauge
            label="5-Hour"
            utilization={u.five_hour.utilization}
            size="lg"
          />
          <div className="mt-4">
            <Countdown
              resetsAt={u.five_hour.resets_at}
              utilization={u.five_hour.utilization}
              now={now}
              label="resets in"
            />
          </div>
        </div>

        {/* ── WEEKLY column ── */}
        <div
          className="flex flex-col items-center py-8"
          style={{ borderRight: '1px solid var(--border-faint)' }}
        >
          <RingGauge
            label="Weekly"
            utilization={u.weekly.utilization}
            size="lg"
          />
          <div className="mt-4">
            <Countdown
              resetsAt={u.weekly.resets_at}
              utilization={u.weekly.utilization}
              now={now}
              label="resets in"
            />
          </div>
        </div>

        {/* ── Sidebar: models + credit ── */}
        <div
          className="flex flex-col justify-center px-8 py-8 gap-6"
        >
          {/* Per-model */}
          <div>
            <div
              className="font-condensed font-semibold tracking-[0.16em] uppercase mb-4"
              style={{ fontSize: 9, color: 'var(--text-faint)' }}
            >
              Per Model · Weekly
            </div>
            <div className="flex flex-col gap-4">
              <ModelRow name="Sonnet" data={u.weekly_sonnet ?? null} now={now} />
              <ModelRow name="Opus"   data={u.weekly_opus   ?? null} now={now} />
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border-faint)' }} />

          {/* Extra usage credit meter */}
          <CreditMeter data={u.extra_usage} />
        </div>
      </div>

      {/* Sparklines row */}
      <Divider label="7-Day History" />

      <div className="flex gap-12">
        <div className="flex-1">
          <SparkLine
            data={history}
            metric="five_hour"
            width={560}
            height={72}
            label="5-Hour utilization"
          />
        </div>
        <div
          className="w-px self-stretch"
          style={{ background: 'var(--border-faint)' }}
        />
        <div className="flex-1">
          <SparkLine
            data={history}
            metric="weekly"
            width={560}
            height={72}
            label="Weekly utilization"
          />
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-12 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border-faint)', paddingTop: 16 }}
      >
        <span
          className="font-condensed"
          style={{ fontSize: 10, color: 'var(--text-faint)' }}
        >
          Refreshes every 5 min · data committed by scheduler
        </span>
        <span
          className="font-condensed"
          style={{ fontSize: 10, color: 'var(--text-faint)' }}
        >
          claude-pulse
        </span>
      </div>
    </div>
  )
}
