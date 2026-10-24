import { StatusIcon } from '@/components/status'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCount } from '@/lib/format'
import type { AlertSeverity, AlertStats } from '@/types'

interface Tile {
  label: string
  value: number | undefined
  caption: string
  severity?: AlertSeverity
}

export function StatTiles({ stats, totalApis }: { stats: AlertStats | undefined; totalApis: number | undefined }) {
  const tiles: Tile[] = [
    {
      label: 'Active alerts',
      value: stats?.active,
      caption: stats ? `${formatCount(stats.resolvedLast24h)} resolved in the last 24 h` : '',
    },
    { label: 'Critical', value: stats?.critical, caption: 'Server errors or very slow responses', severity: 'critical' },
    { label: 'Warnings', value: stats?.warning, caption: 'Client errors, slowness or bad data', severity: 'warning' },
    {
      label: 'APIs affected',
      value: stats?.apisAffected,
      caption: totalApis === undefined ? '' : `of ${formatCount(totalApis)} monitored`,
    },
  ]

  return (
    // gap-px over a border-coloured background draws hairlines between the tiles at any column count.
    <section aria-label="Alert counts" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-card p-4 sm:p-5">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {tile.severity && <StatusIcon severity={tile.severity} className="size-3.5" />}
            {tile.label}
          </p>
          {tile.value === undefined ? (
            <Skeleton className="mt-2 h-8 w-14" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight">{formatCount(tile.value)}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{tile.caption}</p>
        </div>
      ))}
    </section>
  )
}
