import { useEffect, useState, useCallback } from 'react'
import type { UsageData, HistoryPoint, DataState } from '../types'
import { minutesSince } from '../utils/format'

const BASE = import.meta.env.BASE_URL

// Blueprint: fresh within ~20min; stale if older (≈missed cadence)
const FRESH_MINS = 20

export interface UsageStore {
  usage:   UsageData | null
  history: HistoryPoint[]
  state:   DataState
  now:     string
  refresh: () => void
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function useUsageData(pollMs = 300_000): UsageStore {
  const [usage,   setUsage]   = useState<UsageData | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [state,   setState]   = useState<DataState>('loading')
  const [now,     setNow]     = useState(() => new Date().toISOString())

  const load = useCallback(async () => {
    const ts = new Date().toISOString()
    setNow(ts)
    try {
      const [u, h] = await Promise.all([
        fetchJSON<UsageData>(`${BASE}data/usage.json`),
        fetchJSON<HistoryPoint[]>(`${BASE}data/history.json`).catch(() => [] as HistoryPoint[]),
      ])
      setUsage(u)
      setHistory(h)
      if (u.error) {
        setState('error')
        return
      }
      const age = minutesSince(u.fetched_at, ts)
      setState(age <= FRESH_MINS ? 'fresh' : 'stale')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, pollMs)
    return () => clearInterval(id)
  }, [load, pollMs])

  return { usage, history, state, now, refresh: load }
}
