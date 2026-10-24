import type { AlertSeverity, AlertStatusFilter } from '@/types'

/** What the alerts section is showing: a status tab, a severity, an API-name search and a page. */
export interface AlertFilters {
  status: AlertStatusFilter
  severity: AlertSeverity | 'all'
  search: string
  page: number
}

export const DEFAULT_ALERT_FILTERS: AlertFilters = { status: 'active', severity: 'all', search: '', page: 1 }
