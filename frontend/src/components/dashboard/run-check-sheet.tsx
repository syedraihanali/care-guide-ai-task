import { FileJsonIcon, Loader2Icon, RotateCcwIcon, SendIcon, ShuffleIcon } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useRunCheck } from '@/hooks/use-run-check'
import { ApiError } from '@/lib/api'
import { RECOVERY_BATCH, randomBatch, SAMPLE_BATCH } from '@/lib/batches'
import { formatCount, plural } from '@/lib/format'
import type { InvalidItem, MonitorResult } from '@/types'

interface RunCheckSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RunCheckSheet({ open, onOpenChange }: RunCheckSheetProps) {
  const [text, setText] = useState(SAMPLE_BATCH)
  const [parseError, setParseError] = useState<string | null>(null)
  const runCheck = useRunCheck()
  const itemCount = countItems(text)

  function load(batch: string) {
    setText(batch)
    setParseError(null)
    runCheck.reset()
  }

  function submit() {
    let batch: unknown
    try {
      batch = JSON.parse(text)
    } catch (error) {
      setParseError(`This isn't valid JSON yet: ${(error as Error).message}`)
      return
    }
    setParseError(null)
    runCheck.mutate(batch)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Run a check</SheetTitle>
          <SheetDescription>
            Send API results to the monitor as JSON: one object, or an array of them. Each result needs an api_name;
            any other problem in a result is reported as an anomaly.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => load(SAMPLE_BATCH)}>
              <FileJsonIcon data-icon="inline-start" />
              Load sample
            </Button>
            <Button variant="outline" size="sm" onClick={() => load(RECOVERY_BATCH)}>
              <RotateCcwIcon data-icon="inline-start" />
              Load recovery
            </Button>
            <Button variant="outline" size="sm" onClick={() => load(randomBatch())}>
              <ShuffleIcon data-icon="inline-start" />
              Random batch
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="batch-json" className="text-sm font-medium">
                Batch
              </label>
              <span className="text-xs text-muted-foreground">
                {itemCount === null ? 'Not valid JSON' : plural(itemCount, 'item')}
              </span>
            </div>
            <Textarea
              id="batch-json"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              aria-invalid={parseError !== null}
              aria-describedby="batch-help"
              className="h-72 resize-y font-mono text-xs leading-5 field-sizing-fixed md:text-xs"
            />
            <p id="batch-help" className="text-xs text-muted-foreground">
              Press Ctrl+Enter to submit.
            </p>
            {parseError && (
              <p role="alert" className="text-sm text-critical">
                {parseError}
              </p>
            )}
          </div>

          {runCheck.isError && <SubmitError error={runCheck.error} />}
          {runCheck.data && <ResultSummary result={runCheck.data} />}
        </div>

        <SheetFooter className="flex-row justify-end border-t">
          <Button onClick={submit} disabled={runCheck.isPending}>
            {runCheck.isPending ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            {runCheck.isPending ? 'Submitting' : 'Submit batch'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ResultSummary({ result }: { result: MonitorResult }) {
  const rows: Array<[string, number]> = [
    ['Processed', result.processed],
    ['Healthy', result.healthy],
    ['Anomalies', result.anomalies],
    ['Alerts created', result.alerts.created],
    ['Alerts updated', result.alerts.updated],
    ['Auto-resolved', result.alerts.autoResolved],
  ]
  const { mode, calls, fallbacks } = result.llm

  return (
    <section aria-live="polite" aria-label="Result" className="rounded-xl border bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Batch processed</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{formatCount(result.durationMs)} ms</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tracking-tight">{formatCount(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        {result.received === result.processed
          ? `${plural(result.received, 'result')} received. `
          : `${plural(result.received, 'result')} received, ${formatCount(result.invalid.length)} skipped. `}
        {mode === 'ai'
          ? `Alert text by the LLM: ${plural(calls, 'call')}, ${plural(fallbacks, 'template fallback')}.`
          : 'Alert text from templates (template mode).'}
      </p>
      {result.invalid.length > 0 && <InvalidItems items={result.invalid} />}
    </section>
  )
}

function InvalidItems({ items }: { items: InvalidItem[] }) {
  return (
    <div className="mt-3 border-t pt-3">
      <h4 className="text-xs font-medium">Skipped results</h4>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item.index}>
            Index {item.index}: {item.reason}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SubmitError({ error }: { error: Error }) {
  const invalid = error instanceof ApiError ? invalidItemsFrom(error.details) : []
  return (
    <section role="alert" className="rounded-xl border border-critical/40 bg-critical/[0.06] p-4">
      <h3 className="text-sm font-semibold">The batch was not processed</h3>
      <p className="mt-1 text-sm">{error.message}</p>
      {invalid.length > 0 && <InvalidItems items={invalid} />}
      {error instanceof ApiError && error.requestId && (
        <p className="mt-2 text-xs text-muted-foreground">Request ID {error.requestId}</p>
      )}
    </section>
  )
}

/** A 400 for an all-invalid batch carries `{ invalid: [...] }` in its details. */
function invalidItemsFrom(details: unknown): InvalidItem[] {
  const invalid = (details as { invalid?: unknown } | undefined)?.invalid
  return Array.isArray(invalid) ? (invalid as InvalidItem[]) : []
}

function countItems(text: string): number | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.length : 1
  } catch {
    return null
  }
}
