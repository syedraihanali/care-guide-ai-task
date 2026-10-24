import { DatabaseIcon, RefreshCwIcon, ServerOffIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { API_URL } from '@/lib/api'

interface ConnectionErrorProps {
  reason: 'backend' | 'database'
  onRetry: () => void
}

/** Shown instead of the dashboard when the backend or its database can't be reached. */
export function ConnectionError({ reason, onRetry }: ConnectionErrorProps) {
  const backend = reason === 'backend'
  const Icon = backend ? ServerOffIcon : DatabaseIcon

  return (
    <section role="alert" className="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
      <Icon aria-hidden className="size-8 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        {backend ? "Can't reach the backend" : 'The database is unavailable'}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground text-pretty">
        {backend ? (
          <>
            Start the backend with <code className="rounded bg-muted px-1 py-0.5 text-foreground">npm run dev</code>. This
            page reconnects on its own.
          </>
        ) : (
          <>
            The backend is running, but MongoDB isn't. Start it with{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">npm run db:up</code>.
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Checking {API_URL} every 10 seconds.</p>
      <Button variant="outline" className="mt-6" onClick={onRetry}>
        <RefreshCwIcon data-icon="inline-start" />
        Try again
      </Button>
    </section>
  )
}
