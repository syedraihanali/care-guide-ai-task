import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/hooks/use-dashboard-queries'
import { api } from '@/lib/api'
import type { Alert, AlertPage, AlertQuery, AlertStats } from '@/types'

/** Resolves an alert optimistically: it leaves the active list at once and comes back if the request fails. */
export function useResolveAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (alert: Alert) => api.resolveAlert(alert.id),

    onMutate: async (alert) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.alertLists }),
        queryClient.cancelQueries({ queryKey: queryKeys.alertStats }),
      ])
      const previousLists = queryClient.getQueriesData<AlertPage>({ queryKey: queryKeys.alertLists })
      const previousStats = queryClient.getQueryData<AlertStats>(queryKeys.alertStats)

      const resolvedAt = new Date().toISOString()
      for (const [key, page] of previousLists) {
        if (!page) continue
        const query = key[1] as AlertQuery | undefined
        queryClient.setQueryData<AlertPage>(key, markResolved(page, alert.id, resolvedAt, query?.status === 'active'))
      }
      if (previousStats) queryClient.setQueryData<AlertStats>(queryKeys.alertStats, withoutActive(previousStats, alert))

      return { previousLists, previousStats }
    },

    onError: (error, alert, snapshot) => {
      for (const [key, page] of snapshot?.previousLists ?? []) queryClient.setQueryData(key, page)
      if (snapshot?.previousStats) queryClient.setQueryData(queryKeys.alertStats, snapshot.previousStats)
      toast.error(`Couldn't resolve ${alert.apiName}`, { description: error.message })
    },

    onSuccess: (alert) => {
      toast.success(`Resolved ${alert.apiName}`, { description: alert.title })
    },

    // Whatever happened, reload the real state: lists, stats and API statuses.
    onSettled: () => queryClient.invalidateQueries(),
  })
}

function markResolved(page: AlertPage, id: string, resolvedAt: string, removeFromList: boolean): AlertPage {
  if (removeFromList) {
    const data = page.data.filter((alert) => alert.id !== id)
    return { ...page, data, total: page.total - (page.data.length - data.length) }
  }
  return {
    ...page,
    data: page.data.map((alert) =>
      alert.id === id ? { ...alert, status: 'resolved', resolvedAt, resolvedBy: 'user' } : alert,
    ),
  }
}

function withoutActive(stats: AlertStats, alert: Alert): AlertStats {
  const minusOne = (value: number) => Math.max(0, value - 1)
  return {
    ...stats,
    active: minusOne(stats.active),
    critical: alert.severity === 'critical' ? minusOne(stats.critical) : stats.critical,
    warning: alert.severity === 'warning' ? minusOne(stats.warning) : stats.warning,
    apisAffected: minusOne(stats.apisAffected),
    resolvedLast24h: stats.resolvedLast24h + 1,
  }
}
