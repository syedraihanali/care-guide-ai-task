import type {
  Alert,
  AlertPage,
  AlertQuery,
  AlertStats,
  ApiStatus,
  EmailReportResult,
  Health,
  MonitorResult,
} from '@/types'

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

/** A failed API call. A status of 0 means the backend could not be reached at all. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown
  readonly requestId: string | undefined

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

interface ErrorBody {
  error: { code?: string; message?: string; details?: unknown; requestId?: string }
}

function isErrorBody(body: unknown): body is ErrorBody {
  return typeof body === 'object' && body !== null && typeof (body as ErrorBody).error === 'object'
}

async function send(path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', `Can't reach the backend at ${API_URL}`)
  }
  const body: unknown = await response.json().catch(() => null)
  return { status: response.status, body }
}

function toApiError(status: number, body: unknown): ApiError {
  const error = isErrorBody(body) ? body.error : undefined
  return new ApiError(
    status,
    error?.code ?? 'HTTP_ERROR',
    error?.message ?? `The request failed with status ${status}`,
    error?.details,
    error?.requestId,
  )
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { status, body } = await send(path, init)
  if (status >= 400) throw toApiError(status, body)
  return body as T
}

function alertSearchParams(query: AlertQuery): string {
  const params = new URLSearchParams({ status: query.status, page: String(query.page), limit: String(query.limit) })
  if (query.severity) params.set('severity', query.severity)
  if (query.apiName) params.set('apiName', query.apiName)
  return params.toString()
}

export const api = {
  /** GET /health answers 503 with a normal body while the database is down; that is data, not an error. */
  async health(): Promise<Health> {
    const { status, body } = await send('/health')
    if (status === 200 || status === 503) return body as Health
    throw toApiError(status, body)
  },
  alertStats: () => request<AlertStats>('/alerts/stats'),
  apiStatuses: async () => (await request<{ data: ApiStatus[] }>('/apis/status')).data,
  alerts: (query: AlertQuery) => request<AlertPage>(`/alerts?${alertSearchParams(query)}`),
  resolveAlert: (id: string) => request<Alert>(`/alerts/${encodeURIComponent(id)}/resolve`, { method: 'PATCH' }),
  runMonitor: (batch: unknown) =>
    request<MonitorResult>('/monitor', { method: 'POST', body: JSON.stringify(batch) }),
  emailReport: () => request<EmailReportResult>('/alerts/report/email', { method: 'POST' }),
}
