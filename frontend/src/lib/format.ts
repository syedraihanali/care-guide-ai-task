import { format, formatDistanceStrict } from 'date-fns'
import type { IssueType } from '@/types'

const numbers = new Intl.NumberFormat('en-US')

export function formatCount(value: number): string {
  return numbers.format(value)
}

export function formatMs(value: number | null): string {
  return value === null ? 'n/a' : `${numbers.format(value)} ms`
}

export function formatMetric(value: number | null): string {
  return value === null ? 'n/a' : numbers.format(value)
}

/** "just now", "12 seconds ago", "5 minutes ago"... relative to `now`, so a ticking clock keeps it fresh. */
export function timeAgo(date: string | number, now: number): string {
  const time = typeof date === 'number' ? date : Date.parse(date)
  if (now - time < 5_000) return 'just now'
  return formatDistanceStrict(time, now, { addSuffix: true })
}

export function formatDateTime(date: string | number): string {
  return format(date, 'PPpp')
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`
}

export const ISSUE_LABELS: Record<IssueType, string> = {
  SERVER_ERROR: 'Server error',
  CLIENT_ERROR: 'Client error',
  UNEXPECTED_STATUS: 'Unexpected status',
  HIGH_LATENCY: 'High latency',
  EMPTY_DATA: 'No records',
  MISSING_DATA: 'Missing record count',
  INVALID_DATA: 'Malformed data',
}
