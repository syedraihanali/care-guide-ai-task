import { QueryClient } from '@tanstack/react-query'

export const POLL_INTERVAL_MS = 10_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: POLL_INTERVAL_MS,
      staleTime: 5_000,
      retry: 1,
      retryDelay: 1_000,
    },
  },
})
