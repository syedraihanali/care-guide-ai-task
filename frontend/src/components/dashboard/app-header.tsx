import { useIsFetching, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { ActivityIcon, FileTextIcon, Loader2Icon, MailIcon, PlayIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAlertStats, useApiStatuses, useHealth } from '@/hooks/use-dashboard-queries'
import { useEmailReport } from '@/hooks/use-email-report'
import { useNow } from '@/hooks/use-now'
import { API_URL } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Health } from '@/types'

export function AppHeader({ onRunCheck }: { onRunCheck: () => void }) {
  const queryClient = useQueryClient()
  const fetching = useIsFetching() > 0
  const health = useHealth()
  const stats = useAlertStats()
  const apis = useApiStatuses()
  const emailReport = useEmailReport()
  const now = useNow(1_000)
  const updatedAt = Math.max(health.dataUpdatedAt, stats.dataUpdatedAt, apis.dataUpdatedAt)

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background">
            <ActivityIcon aria-hidden className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">API Monitor</span>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ConnectionStatus health={health} />
          <LlmModeBadge health={health.data} />
          {updatedAt > 0 && (
            <span className="hidden px-1 text-xs text-muted-foreground lg:inline">Updated {timeAgo(updatedAt, now)}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void queryClient.invalidateQueries()}
            aria-label="Refresh now"
            title="Refresh now"
          >
            <RefreshCwIcon className={cn(fetching && 'animate-spin motion-reduce:animate-none')} />
          </Button>
          <ThemeToggle />
          <Button
            variant="outline"
            onClick={() => emailReport.mutate()}
            disabled={emailReport.isPending}
            className="ml-1"
            title="Email a report of all active alerts"
          >
            {emailReport.isPending ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <MailIcon data-icon="inline-start" />
            )}
            <span className="sr-only md:not-sr-only">Email report</span>
          </Button>
          <Button onClick={onRunCheck}>
            <PlayIcon data-icon="inline-start" />
            <span className="sr-only sm:not-sr-only">Run a check</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

function ConnectionStatus({ health }: { health: UseQueryResult<Health> }) {
  const state = health.isError ? 'offline' : !health.data ? 'connecting' : health.data.db === 'up' ? 'online' : 'dbDown'
  const { dot, label, detail } = {
    online: { dot: 'bg-healthy', label: 'Online', detail: `Backend and database are up (${API_URL})` },
    dbDown: { dot: 'bg-critical', label: 'Database down', detail: 'The backend is running, but MongoDB is unreachable' },
    offline: { dot: 'bg-critical', label: 'Offline', detail: `Can't reach the backend at ${API_URL}` },
    connecting: { dot: 'bg-muted-foreground', label: 'Connecting', detail: `Connecting to ${API_URL}` },
  }[state]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span aria-hidden className={cn('size-2 rounded-full', dot)} />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  )
}

function LlmModeBadge({ health }: { health: Health | undefined }) {
  if (!health) return null
  const ai = health.llm === 'ai'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className="hidden cursor-default md:inline-flex">
          {ai ? <SparklesIcon /> : <FileTextIcon />}
          {ai ? `AI · ${health.model}` : 'Template mode'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {ai ? `Alert text is written by ${health.model}` : 'No OpenAI key: alert text comes from built-in templates'}
      </TooltipContent>
    </Tooltip>
  )
}
