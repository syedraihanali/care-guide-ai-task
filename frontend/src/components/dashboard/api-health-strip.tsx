import { StatusIcon } from '@/components/status'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useNow } from '@/hooks/use-now'
import { formatCount, formatMetric, formatMs, ISSUE_LABELS, timeAgo } from '@/lib/format'
import { STATUS } from '@/lib/status'
import type { ApiStatus, CheckSeverity } from '@/types'

const SEVERITY_ORDER: Record<CheckSeverity, number> = { critical: 0, warning: 1, healthy: 2 }

interface ApiHealthStripProps {
  apis: ApiStatus[] | undefined
  checksLast24h: number | undefined
  onSelect: (api: ApiStatus) => void
}

/** One chip per API, worst first. A chip's tooltip shows its latest check; clicking it filters the alerts. */
export function ApiHealthStrip({ apis, checksLast24h, onSelect }: ApiHealthStripProps) {
  const now = useNow(15_000)

  return (
    <section aria-labelledby="api-health-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="api-health-heading" className="text-base font-semibold tracking-tight">
          API health
        </h2>
        {apis && apis.length > 0 && <Legend apis={apis} checksLast24h={checksLast24h} />}
      </div>

      {!apis ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-32 rounded-full" />
          ))}
        </div>
      ) : apis.length === 0 ? (
        <p className="text-sm text-muted-foreground">No checks yet. Each API appears here after its first check.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {[...apis]
            .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.apiName.localeCompare(b.apiName))
            .map((api) => (
              <li key={api.apiName}>
                <ApiChip api={api} now={now} onSelect={onSelect} />
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}

function Legend({ apis, checksLast24h }: { apis: ApiStatus[]; checksLast24h: number | undefined }) {
  const counts = (['critical', 'warning', 'healthy'] as const).map((severity) => ({
    severity,
    count: apis.filter((api) => api.severity === severity).length,
  }))
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {counts.map(({ severity, count }) => (
        <span key={severity} className="inline-flex items-center gap-1">
          <StatusIcon severity={severity} className="size-3.5" />
          {formatCount(count)} {STATUS[severity].label.toLowerCase()}
        </span>
      ))}
      {checksLast24h !== undefined && <span>{formatCount(checksLast24h)} checks in the last 24 h</span>}
    </div>
  )
}

function ApiChip({ api, now, onSelect }: { api: ApiStatus; now: number; onSelect: (api: ApiStatus) => void }) {
  const rows: Array<[string, string]> = [
    ['Status', api.metrics.statusCode === null ? 'n/a' : `HTTP ${api.metrics.statusCode}`],
    ['Latency', formatMs(api.metrics.responseTimeMs)],
    ['Records', formatMetric(api.metrics.recordsReturned)],
    ['Checked', timeAgo(api.checkedAt, now)],
  ]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(api)}
          aria-label={`${api.apiName}: ${STATUS[api.severity].label}. Show its alerts.`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card pr-3 pl-2 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <StatusIcon severity={api.severity} className="size-3.5" />
          {api.apiName}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="block min-w-48 py-2.5">
        <p className="font-semibold">
          {api.apiName}: {STATUS[api.severity].label.toLowerCase()}
        </p>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="opacity-70">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {api.issueTypes.length > 0 && (
          <p className="mt-1.5 opacity-70">{api.issueTypes.map((type) => ISSUE_LABELS[type]).join(', ')}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
