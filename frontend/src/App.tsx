import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { AlertsSection } from '@/components/dashboard/alerts-section'
import { ApiHealthStrip } from '@/components/dashboard/api-health-strip'
import { AppHeader } from '@/components/dashboard/app-header'
import { ConnectionError } from '@/components/dashboard/connection-error'
import { RunCheckSheet } from '@/components/dashboard/run-check-sheet'
import { StatTiles } from '@/components/dashboard/stat-tiles'
import { StatusBanner } from '@/components/dashboard/status-banner'
import { useAlertStats, useApiStatuses, useHealth } from '@/hooks/use-dashboard-queries'
import { DEFAULT_ALERT_FILTERS, type AlertFilters } from '@/lib/alert-filters'
import type { ApiStatus } from '@/types'

function App() {
  const queryClient = useQueryClient()
  const [runCheckOpen, setRunCheckOpen] = useState(false)
  const [filters, setFilters] = useState<AlertFilters>(DEFAULT_ALERT_FILTERS)
  const health = useHealth()
  const stats = useAlertStats()
  const apis = useApiStatuses()

  // Any filter change starts again from the first page, unless the change is the page itself.
  const changeFilters = useCallback((changes: Partial<AlertFilters>) => {
    setFilters((current) => ({ ...current, page: 1, ...changes }))
  }, [])

  function showApi(api: ApiStatus) {
    setFilters({ ...DEFAULT_ALERT_FILTERS, status: api.activeAlert ? 'active' : 'all', search: api.apiName })
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('alerts')?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  }

  const unreachable = health.isError ? 'backend' : health.data?.db === 'down' ? 'database' : null
  const openRunCheck = () => setRunCheckOpen(true)

  return (
    <div className="min-h-svh bg-background">
      <AppHeader onRunCheck={openRunCheck} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        {unreachable ? (
          <ConnectionError reason={unreachable} onRetry={() => void queryClient.invalidateQueries()} />
        ) : (
          <>
            <div className="space-y-4">
              <StatusBanner stats={stats.data} apis={apis.data} />
              <StatTiles stats={stats.data} totalApis={apis.data?.length} />
            </div>
            <ApiHealthStrip apis={apis.data} checksLast24h={stats.data?.checksLast24h} onSelect={showApi} />
            <AlertsSection
              filters={filters}
              onFiltersChange={changeFilters}
              activeCount={stats.data?.active}
              onRunCheck={openRunCheck}
            />
          </>
        )}
      </main>
      <RunCheckSheet open={runCheckOpen} onOpenChange={setRunCheckOpen} />
    </div>
  )
}

export default App
