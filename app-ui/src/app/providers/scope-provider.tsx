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
  synchronizeScope: (input: { organizationId: string; authorizedScopeIds: string[]; preferredScopeId?: string | null; allowAll: boolean }) => void
}

const ScopeContext = createContext<ScopeContextValue | null>(null)

interface PersistedScope {
  organizationId: string
  scopeId: string
}

/** Reads one organization-bound persisted scope selection. */
function readPersistedScope(): PersistedScope | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage?.getItem(STORAGE_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<PersistedScope>
    return typeof parsed.organizationId === 'string' && typeof parsed.scopeId === 'string'
      ? { organizationId: parsed.organizationId, scopeId: parsed.scopeId }
      : null
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
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (!organizationId) return
      if (selectedScopeId) {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ organizationId, scopeId: selectedScopeId }))
      } else {
        window.localStorage?.removeItem(STORAGE_KEY)
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }, [organizationId, selectedScopeId])

  const value = useMemo<ScopeContextValue>(
    () => ({
      selectedScopeId,
      setScope: setSelectedScopeId,
      clearScope: () => setSelectedScopeId(null),
      synchronizeScope: ({ organizationId: nextOrganizationId, authorizedScopeIds, preferredScopeId, allowAll }) => {
        const authorized = new Set(authorizedScopeIds)
        const persisted = readPersistedScope()
        setOrganizationId(nextOrganizationId)
        setSelectedScopeId((current) => {
          if (organizationId === nextOrganizationId && current && authorized.has(current)) return current
          if (persisted?.organizationId === nextOrganizationId && authorized.has(persisted.scopeId)) return persisted.scopeId
          if (preferredScopeId && authorized.has(preferredScopeId)) return preferredScopeId
          return allowAll ? null : authorizedScopeIds[0] ?? null
        })
      },
    }),
    [organizationId, selectedScopeId],
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
