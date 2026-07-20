import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'wf-sidebar-collapsed'
/** Below this width the desktop sidebar defaults to collapsed. */
const COMPACT_QUERY = '(max-width: 1279px)'

interface SidebarContextValue {
  /** Desktop rail collapsed (icon-only) vs expanded (labelled). */
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

/** Resolves the initial collapsed state from storage, else the viewport size. */
function readInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    /* storage unavailable (e.g. tests) — fall back to viewport */
  }
  return window.matchMedia?.(COMPACT_QUERY).matches ?? false
}

interface SidebarProviderProps {
  children: ReactNode
}

/** Owns the collapsible-sidebar state, persists it, and wires a Ctrl/⌘-B toggle. */
export function SidebarProvider({ children }: SidebarProviderProps) {
  const [collapsed, setCollapsedState] = useState<boolean>(readInitialCollapsed)

  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, String(collapsed))
    } catch {
      /* storage unavailable — ignore */
    }
  }, [collapsed])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== 'b'
      ) {
        return
      }
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return
      }
      event.preventDefault()
      setCollapsedState((current) => !current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const value = useMemo<SidebarContextValue>(
    () => ({
      collapsed,
      setCollapsed: setCollapsedState,
      toggle: () => setCollapsedState((current) => !current),
    }),
    [collapsed],
  )

  return <SidebarContext value={value}>{children}</SidebarContext>
}

/** Reads the sidebar context; throws if used outside the provider. */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
