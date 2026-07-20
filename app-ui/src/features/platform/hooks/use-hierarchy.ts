import { useQuery } from '@tanstack/react-query'
import { fetchHierarchy } from '../platform.contract'

/** Loads the configurable org hierarchy tree (Scope Switcher + scope pickers). */
export function useHierarchy() {
  return useQuery({
    queryKey: ['hierarchy'],
    queryFn: fetchHierarchy,
    staleTime: 5 * 60 * 1000,
  })
}
