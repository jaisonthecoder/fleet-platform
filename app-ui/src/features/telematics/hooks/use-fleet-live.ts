import { useQuery } from '@tanstack/react-query'
import { fetchFleetLive } from '../live-map.contract'

/** Polls the scoped fleet's latest positions (each read is audited server-side). */
export function useFleetLive() {
  return useQuery({
    queryKey: ['fleet-live'],
    queryFn: fetchFleetLive,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}
