import { QueryClient } from '@tanstack/react-query'

/** Creates the shared TanStack Query client with the app's default policy. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 15_000,
      },
    },
  })
}
