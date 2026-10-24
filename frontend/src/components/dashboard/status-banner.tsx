import { StatusIcon } from '@/components/status'
import { Skeleton } from '@/components/ui/skeleton'
import { useNow } from '@/hooks/use-now'
import { formatCount, plural, timeAgo } from '@/lib/format'
import { STATUS } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { AlertStats, ApiStatus, CheckSeverity } from '@/types'

/** The first thing on the page: is anything broken right now? */
export function StatusBanner({ stats, apis }: { stats: AlertStats | undefined; apis: ApiStatus[] | undefined }) {
  const now = useNow(15_000)
  if (!stats || !apis) return <Skeleton className="h-28 rounded-xl" />

  const tone: CheckSeverity = stats.critical > 0 ? 'critical' : stats.warning > 0 ? 'warning' : 'healthy'
  const { headline, detail } = describe(stats, apis)
  const lastCheck = Math.max(0, ...apis.map((api) => Date.parse(api.checkedAt)))

  return (
    <section
      aria-label="Overall status"
      className={cn('flex items-start gap-4 rounded-xl border p-5 sm:p-6', STATUS[tone].surfaceClass)}
    >
      <StatusIcon severity={tone} className="mt-1 size-6 sm:size-7" />
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{headline}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{detail}</p>
      </div>
      {lastCheck > 0 && (
        <p className="hidden shrink-0 pt-1.5 text-sm text-muted-foreground md:block">Last check {timeAgo(lastCheck, now)}</p>
      )}
    </section>
  )
}

function describe(stats: AlertStats, apis: ApiStatus[]): { headline: string; detail: string } {
  if (apis.length === 0) {
    return {
      headline: 'Waiting for the first check',
      detail: 'Send API results with Run a check, or run npm run monitor:file in a terminal.',
    }
  }
  const affected = `${formatCount(stats.apisAffected)} of ${plural(apis.length, 'monitored API')}`
  if (stats.critical > 0) {
    return {
      headline: plural(stats.critical, 'critical incident'),
      detail: `${affected} need attention: ${formatCount(stats.critical)} critical, ${formatCount(stats.warning)} warning.`,
    }
  }
  if (stats.warning > 0) {
    return {
      headline: `${plural(stats.warning, 'API')} ${stats.warning === 1 ? 'needs' : 'need'} attention`,
      detail: `No critical incidents. ${affected} have warnings.`,
    }
  }
  const failing = apis.filter((api) => !api.healthy).length
  return {
    headline: 'No active incidents',
    detail:
      failing === 0
        ? `All ${plural(apis.length, 'monitored API')} passed their latest check.`
        : `${plural(failing, 'API')} failed the latest check, but their alerts are resolved.`,
  }
}
