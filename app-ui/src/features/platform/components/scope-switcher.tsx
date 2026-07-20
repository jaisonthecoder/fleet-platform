import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useScope } from '@/app/providers/scope-provider'
import { useAuth } from '@/features/auth/auth-context'
import { useHierarchy } from '../hooks/use-hierarchy'
import { flattenHierarchy } from '../platform.contract'

/**
 * Operational scope selector. Reads the configurable hierarchy, lets the user
 * pick the node they are working within, and stores it in the scope context.
 * Seeds the user's home pool once identity loads. Hidden until the hierarchy
 * has at least one node (keeps the header clean while loading / for role-less users).
 */
export function ScopeSwitcher() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const { selectedScopeId, setScope, clearScope } = useScope()
  const { data } = useHierarchy()
  const [open, setOpen] = useState(false)

  const nodes = useMemo(() => flattenHierarchy(data ?? []), [data])
  const selectableNodes = useMemo(() => {
    const roleScopePaths = (me?.roles ?? [])
      .map((role) => nodes.find((node) => node.id === role.scopeNodeId)?.path)
      .filter((path): path is string => Boolean(path))
    return nodes.filter((node) =>
      roleScopePaths.some(
        (scopePath) =>
          node.path === scopePath || node.path.startsWith(`${scopePath}.`),
      ),
    )
  }, [me?.roles, nodes])
  const canSelectAll = useMemo(() => {
    const rootIds = new Set(nodes.filter((node) => node.parentId === null).map((node) => node.id))
    return (me?.roles ?? []).some((role) => rootIds.has(role.scopeNodeId))
  }, [me?.roles, nodes])

  // Seed the default scope from the user's home pool the first time we can.
  useEffect(() => {
    if (selectedScopeId || !me?.homePoolNodeId || nodes.length === 0) return
    if (nodes.some((n) => n.id === me.homePoolNodeId)) {
      setScope(me.homePoolNodeId)
    }
  }, [selectedScopeId, me?.homePoolNodeId, nodes, setScope])

  useEffect(() => {
    if (!selectedScopeId || selectableNodes.length === 0) return
    if (!selectableNodes.some((node) => node.id === selectedScopeId)) {
      setScope(selectableNodes[0]?.id ?? null)
    }
  }, [selectedScopeId, selectableNodes, setScope])

  if (nodes.length === 0) return null

  const current = nodes.find((n) => n.id === selectedScopeId) ?? null
  const label = current
    ? `${current.levelLabel} · ${current.name}`
    : t('scope.allScopes')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('scope.change')}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-[38px] max-w-[220px] items-center gap-2 rounded-[3px] border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-surface-hover"
        >
          <MapPin aria-hidden="true" className="size-[15px] text-signal" />
          <span className="truncate">{label}</span>
          <ChevronsUpDown
            aria-hidden="true"
            className="ms-auto size-[15px] shrink-0 opacity-60"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={t('scope.search')} />
          <CommandList>
            <CommandEmpty>{t('scope.empty')}</CommandEmpty>
            <CommandGroup>
              {canSelectAll ? (
                <CommandItem
                  value={t('scope.allScopes')}
                  onSelect={() => {
                    clearScope()
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'size-4',
                      selectedScopeId ? 'opacity-0' : 'opacity-100',
                    )}
                  />
                  {t('scope.allScopes')}
                </CommandItem>
              ) : null}
              {selectableNodes.map((node) => (
                <CommandItem
                  key={node.id}
                  value={`${node.levelLabel} ${node.name}`}
                  onSelect={() => {
                    setScope(node.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'size-4',
                      selectedScopeId === node.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span
                    className="truncate"
                    style={{ paddingInlineStart: `${node.depth * 12}px` }}
                  >
                    <span className="text-muted-foreground">
                      {node.levelLabel}
                    </span>{' '}
                    · {node.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
