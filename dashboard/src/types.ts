export interface UsageWindow {
  utilization: number | null
  resets_at: string | null
}

export interface ExtraUsage {
  enabled: boolean
  monthly_limit: number
  used_credits: number
  currency: string
}

export interface UsageData {
  fetched_at: string
  five_hour: UsageWindow
  weekly: UsageWindow
  weekly_sonnet: UsageWindow | null
  weekly_opus: UsageWindow | null
  extra_usage: ExtraUsage
  error: string | null
}

export interface HistoryPoint {
  t: string
  five_hour: number | null   // core may write null for windows with no data
  weekly:    number | null
}

export type Severity = 'ok' | 'warn' | 'crit'
export type DataState = 'loading' | 'fresh' | 'stale' | 'error'
