import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { plural } from '@/lib/format'

/** Sends a batch to POST /monitor, then reloads everything the batch may have changed. */
export function useRunCheck() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (batch: unknown) => api.runMonitor(batch),
    onSuccess: (result) => {
      void queryClient.invalidateQueries()
      const { created, updated, autoResolved } = result.alerts
      toast.success('Batch processed', {
        description: `${plural(result.anomalies, 'anomaly', 'anomalies')}: ${created} created, ${updated} updated, ${autoResolved} auto-resolved`,
      })
    },
  })
}
