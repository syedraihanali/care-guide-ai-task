import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AlertQuery } from '@/types'

export const queryKeys = {
  health: ['health'] as const,
  alertStats: ['alert-stats'] as const,
  apiStatuses: ['api-statuses'] as const,
  alertLists: ['alerts'] as const,
  alerts: (query: AlertQuery) => ['alerts', query] as const,
}

// All of these poll every 10 seconds (see lib/query-client.ts).

export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: api.health })
}

export function useAlertStats() {
  return useQuery({ queryKey: queryKeys.alertStats, queryFn: api.alertStats })
}

export function useApiStatuses() {
  return useQuery({ queryKey: queryKeys.apiStatuses, queryFn: api.apiStatuses })
}

export function useAlerts(query: AlertQuery) {
  return useQuery({
    queryKey: queryKeys.alerts(query),
    queryFn: () => api.alerts(query),
    // Keep showing the current list while a new filter loads, instead of flashing skeletons.
    placeholderData: keepPreviousData,
  })
}
