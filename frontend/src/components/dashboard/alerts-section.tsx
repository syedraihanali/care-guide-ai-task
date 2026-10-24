import { ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, InboxIcon, PlayIcon, SearchIcon, SearchXIcon } from 'lucide-react'
import { useEffect } from 'react'
import { AlertCard } from '@/components/dashboard/alert-card'
import { EmptyState } from '@/components/dashboard/empty-state'
import { StatusIcon } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAlerts } from '@/hooks/use-dashboard-queries'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useNow } from '@/hooks/use-now'
import { useResolveAlert } from '@/hooks/use-resolve-alert'
import type { AlertFilters } from '@/lib/alert-filters'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AlertPage, AlertStatusFilter } from '@/types'

const PAGE_SIZE = 20

interface AlertsSectionProps {
  filters: AlertFilters
  onFiltersChange: (changes: Partial<AlertFilters>) => void
  activeCount: number | undefined
  onRunCheck: () => void
}

export function AlertsSection({ filters, onFiltersChange, activeCount, onRunCheck }: AlertsSectionProps) {
  const search = useDebouncedValue(filters.search.trim(), 250)
  const alerts = useAlerts({
    status: filters.status,
    severity: filters.severity === 'all' ? undefined : filters.severity,
    apiName: search || undefined,
    page: filters.page,
    limit: PAGE_SIZE,
  })
  const resolve = useResolveAlert()
  const now = useNow(15_000)
  const page = alerts.data
  const filtered = filters.severity !== 'all' || filters.search.trim() !== ''

  // Resolving the last alert on a later page leaves it empty: step back to the last page that has alerts.
  useEffect(() => {
    if (page && page.data.length === 0 && page.total > 0 && page.page > 1) {
      onFiltersChange({ page: Math.ceil(page.total / page.limit) })
    }
  }, [page, onFiltersChange])

  return (
    <section id="alerts" aria-labelledby="alerts-heading" className="scroll-mt-20">
      <Tabs
        value={filters.status}
        onValueChange={(value) => onFiltersChange({ status: value as AlertStatusFilter })}
        className="gap-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h2 id="alerts-heading" className="text-base font-semibold tracking-tight">
              Alerts
            </h2>
            <TabsList>
              <TabsTrigger value="active" className="px-2.5">
                Active
                {activeCount !== undefined && (
                  <span className="text-muted-foreground tabular-nums">{formatCount(activeCount)}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved" className="px-2.5">
                Resolved
              </TabsTrigger>
              <TabsTrigger value="all" className="px-2.5">
                All
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex gap-2">
            <Select
              value={filters.severity}
              onValueChange={(value) => onFiltersChange({ severity: value as AlertFilters['severity'] })}
            >
              <SelectTrigger aria-label="Filter by severity" className="w-38 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="critical">
                  <StatusIcon severity="critical" />
                  Critical
                </SelectItem>
                <SelectItem value="warning">
                  <StatusIcon severity="warning" />
                  Warning
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={filters.search}
                onChange={(event) => onFiltersChange({ search: event.target.value })}
                placeholder="Filter by API name"
                aria-label="Filter by API name"
                className="pl-8"
              />
            </div>
          </div>
        </div>

        <TabsContent value={filters.status}>
          {!page ? (
            alerts.isError ? (
              <p role="alert" className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Couldn't load alerts: {alerts.error.message}
              </p>
            ) : (
              <AlertListSkeleton />
            )
          ) : page.data.length === 0 ? (
            <EmptyAlerts
              status={filters.status}
              filtered={filtered}
              onClearFilters={() => onFiltersChange({ severity: 'all', search: '' })}
              onRunCheck={onRunCheck}
            />
          ) : (
            <div className={cn('space-y-3 transition-opacity', alerts.isPlaceholderData && 'opacity-60')}>
              <ul className="space-y-3">
                {page.data.map((alert) => (
                  <li key={alert.id}>
                    <AlertCard
                      alert={alert}
                      now={now}
                      onResolve={resolve.mutate}
                      resolving={resolve.isPending && resolve.variables.id === alert.id}
                    />
                  </li>
                ))}
              </ul>
              <Pagination page={page} onPageChange={(next) => onFiltersChange({ page: next })} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}

interface EmptyAlertsProps {
  status: AlertStatusFilter
  filtered: boolean
  onClearFilters: () => void
  onRunCheck: () => void
}

function EmptyAlerts({ status, filtered, onClearFilters, onRunCheck }: EmptyAlertsProps) {
  if (filtered) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="No alerts match these filters"
        action={
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    )
  }
  const runCheck = (
    <Button variant="outline" onClick={onRunCheck}>
      <PlayIcon data-icon="inline-start" />
      Run a check
    </Button>
  )
  if (status === 'active') {
    return (
      <EmptyState
        icon={CircleCheckIcon}
        iconClassName="text-healthy"
        title="All monitored APIs are healthy"
        description="New problems show up here as soon as a check finds them."
        action={runCheck}
      />
    )
  }
  if (status === 'resolved') {
    return (
      <EmptyState
        icon={InboxIcon}
        title="No resolved alerts yet"
        description="Alerts you resolve, and alerts that close when their API recovers, are kept here."
      />
    )
  }
  return <EmptyState icon={InboxIcon} title="No alerts yet" description="Run a check to send API results to the monitor." action={runCheck} />
}

function Pagination({ page, onPageChange }: { page: AlertPage; onPageChange: (page: number) => void }) {
  const pages = Math.ceil(page.total / page.limit)
  if (pages <= 1) return null
  const first = (page.page - 1) * page.limit + 1
  const last = Math.min(page.page * page.limit, page.total)

  return (
    <nav aria-label="Alert pages" className="flex items-center justify-between pt-1 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {formatCount(first)}–{formatCount(last)} of {formatCount(page.total)}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page.page <= 1} onClick={() => onPageChange(page.page - 1)}>
          <ChevronLeftIcon data-icon="inline-start" />
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page.page >= pages} onClick={() => onPageChange(page.page + 1)}>
          Next
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  )
}

function AlertListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading alerts">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border p-5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-72" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-2/3 max-w-md" />
        </div>
      ))}
    </div>
  )
}
