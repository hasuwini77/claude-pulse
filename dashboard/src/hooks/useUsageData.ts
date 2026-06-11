import { useEffect, useState, useCallback } from 'react'
import type { UsageData, HistoryPoint, DataState } from '../types'
import { minutesSince } from '../utils/format'

const BASE = import.meta.env.BASE_URL

interface UsageStore {
  usage: UsageData | null
  history: HistoryPoint[]
  state: DataState
  now: string       // ISO string captured at last load — stable for countdowns
  refresh: () => void
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function useUsageData(pollMs = 300_000): UsageStore {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [state, setState] = useState<DataState>('loading')
  const [now, setNow] = useState<string>(new Date().toISOString())

  const load = useCallback(async () => {
    setNow(new Date().toISOString())
    try {
      const [u, h] = await Promise.all([
        fetchJSON<UsageData>(`${BASE}data/usage.json`),
        fetchJSON<HistoryPoint[]>(`${BASE}data/history.json`).catch(() => []),
      ])

      // If the fetcher wrote an error into the payload
      if (u.error) {
        setState('error')
        setUsage(u)
        setHistory(h)
        return
      }

      setUsage(u)
      setHistory(h)

      const mins = minutesSince(u.fetched_at, new Date().toISOString())
      setState(mins > 30 ? 'stale' : 'fresh')
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
