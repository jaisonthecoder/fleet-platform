import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'wf-scope'

interface ScopeContextValue {
  /** The hierarchy node id the user is currently operating within (null = all). */
  selectedScopeId: string | null
  setScope: (scopeId: string | null) => void
  clearScope: () => void
}

const ScopeContext = createContext<ScopeContextValue | null>(null)

/** Restores the persisted scope selection (null when none / storage unavailable). */
function readInitialScope(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

/**
 * Holds the current operational scope (a hierarchy node id) for the Scope
 * Switcher and any scope-bound screen. Auth-agnostic and persisted; the Scope
 * Switcher seeds a sensible default (the user's home pool) once identity loads.
 */
export function ScopeProvider({ children }: { children: ReactNode }) {
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(
    readInitialScope,
  )

  useEffect(() => {
    try {
      if (selectedScopeId) {
        window.localStorage?.setItem(STORAGE_KEY, selectedScopeId)
      } else {
        window.localStorage?.removeItem(STORAGE_KEY)
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }, [selectedScopeId])

  const value = useMemo<ScopeContextValue>(
    () => ({
      selectedScopeId,
      setScope: setSelectedScopeId,
      clearScope: () => setSelectedScopeId(null),
    }),
    [selectedScopeId],
  )

  return <ScopeContext value={value}>{children}</ScopeContext>
}

/** Reads the scope context; throws if used outside the provider. */
export function useScope(): ScopeContextValue {
  const context = useContext(ScopeContext)
  if (!context) {
    throw new Error('useScope must be used within a ScopeProvider')
  }
  return context
}
