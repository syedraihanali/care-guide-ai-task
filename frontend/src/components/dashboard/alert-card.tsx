import { CheckIcon, CircleCheckIcon, FileTextIcon, SparklesIcon } from 'lucide-react'
import { SeverityBadge, StatusIcon } from '@/components/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCount, formatDateTime, formatMetric, formatMs, ISSUE_LABELS, timeAgo } from '@/lib/format'
import { STATUS } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { Alert, AlertSeverity, Issue, IssueType, Metrics } from '@/types'

/** Which issues each metric can cause, so the metric behind an alert can be marked. */
const METRIC_ISSUES: Record<keyof Metrics, IssueType[]> = {
  statusCode: ['SERVER_ERROR', 'CLIENT_ERROR', 'UNEXPECTED_STATUS'],
  responseTimeMs: ['HIGH_LATENCY'],
  recordsReturned: ['EMPTY_DATA', 'MISSING_DATA'],
}

interface AlertCardProps {
  alert: Alert
  now: number
  onResolve: (alert: Alert) => void
  resolving: boolean
}

export function AlertCard({ alert, now, onResolve, resolving }: AlertCardProps) {
  const active = alert.status === 'active'
  const titleId = `alert-${alert.id}-title`

  return (
    <article
      aria-labelledby={titleId}
      data-api-name={alert.apiName}
      className={cn(
        'rounded-xl border border-l-[3px] p-4 sm:p-5',
        // Resolved alerts are history: a quiet surface and a neutral edge.
        active ? ['bg-card', STATUS[alert.severity].edgeClass] : 'border-l-border bg-muted/40',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <span className="text-sm font-medium">{alert.apiName}</span>
            <span
              title={`Seen in ${formatCount(alert.occurrences)} checks`}
              className="rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums"
            >
              <span aria-hidden>×{formatCount(alert.occurrences)}</span>
              <span className="sr-only">Seen in {formatCount(alert.occurrences)} checks</span>
            </span>
          </div>
          <h3 id={titleId} className="text-base font-semibold tracking-tight text-pretty">
            {alert.title}
          </h3>
        </div>
        <TextSource alert={alert} />
      </div>

      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-pretty">{alert.message}</p>

      <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Likely cause</dt>
          <dd className="mt-1 text-pretty">{alert.likelyCause}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Suggested action</dt>
          <dd className="mt-1 text-pretty">{alert.suggestedAction}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t pt-4">
        <ul aria-label="Issues" className="flex flex-wrap gap-1.5">
          {alert.issues.map((issue) => (
            <li key={`${issue.type}-${issue.detail}`}>
              <IssueChip issue={issue} />
            </li>
          ))}
        </ul>
        <MetricsRow metrics={alert.lastMetrics} issues={alert.issues} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span>
          First seen <RelativeTime date={alert.firstSeen} now={now} />
        </span>
        <span>
          Last seen <RelativeTime date={alert.lastSeen} now={now} />
        </span>
        {active ? (
          <Button variant="outline" size="sm" className="ml-auto" disabled={resolving} onClick={() => onResolve(alert)}>
            <CheckIcon data-icon="inline-start" />
            Resolve
          </Button>
        ) : (
          <ResolvedNote alert={alert} now={now} />
        )}
      </div>
    </article>
  )
}

function TextSource({ alert }: { alert: Alert }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className="cursor-default text-muted-foreground">
          {alert.aiGenerated ? <SparklesIcon /> : <FileTextIcon />}
          {alert.aiGenerated ? 'AI' : 'Template'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {alert.aiGenerated ? `Written by ${alert.aiModel ?? 'the LLM'}` : 'Written from a built-in template'}
      </TooltipContent>
    </Tooltip>
  )
}

function IssueChip({ issue }: { issue: Issue }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" tabIndex={0} className="cursor-default pl-1.5 font-normal">
          <StatusIcon severity={issue.severity} />
          {ISSUE_LABELS[issue.type]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{issue.detail}</TooltipContent>
    </Tooltip>
  )
}

function MetricsRow({ metrics, issues }: { metrics: Metrics; issues: Issue[] }) {
  const items: Array<[string, keyof Metrics, string]> = [
    ['Status', 'statusCode', formatMetric(metrics.statusCode)],
    ['Latency', 'responseTimeMs', formatMs(metrics.responseTimeMs)],
    ['Records', 'recordsReturned', formatMetric(metrics.recordsReturned)],
  ]
  return (
    <dl aria-label="Latest metrics" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {items.map(([label, key, value]) => {
        const flag = metricFlag(key, metrics, issues)
        return (
          <div key={label} className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex items-center gap-1 font-medium tabular-nums">
              {flag && <StatusIcon severity={flag} className="size-3.5" />}
              {value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** The severity to mark a metric with: its issues' worst severity, or a warning when the value is missing. */
function metricFlag(key: keyof Metrics, metrics: Metrics, issues: Issue[]): AlertSeverity | null {
  const related = issues.filter((issue) => METRIC_ISSUES[key].includes(issue.type))
  if (related.some((issue) => issue.severity === 'critical')) return 'critical'
  return related.length > 0 || metrics[key] === null ? 'warning' : null
}

function ResolvedNote({ alert, now }: { alert: Alert; now: number }) {
  if (!alert.resolvedAt) return null
  return (
    <span className="ml-auto inline-flex items-center gap-1.5 text-foreground">
      <CircleCheckIcon aria-hidden className="size-3.5 text-healthy" />
      {alert.resolvedBy === 'auto-recovery' ? 'Auto-resolved when the API recovered' : 'Resolved by a user'}{' '}
      <RelativeTime date={alert.resolvedAt} now={now} />
    </span>
  )
}

function RelativeTime({ date, now }: { date: string; now: number }) {
  return (
    <time dateTime={date} title={formatDateTime(date)}>
      {timeAgo(date, now)}
    </time>
  )
}
