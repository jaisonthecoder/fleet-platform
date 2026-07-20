import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Archive,
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  History,
  MoveRight,
  Pencil,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/patterns/empty-state'
import { StatCard } from '@/components/patterns/stat-card'
import { cn } from '@/lib/utils'
import { ApiRequestError } from '@/lib/api-client'
import { notify } from '@/hooks/use-toast'
import {
  flattenOrganizationTree,
  type OrganizationNodeDetail,
  type OrganizationHierarchyNode,
} from './organization.contract'
import {
  useCreateHierarchyNode,
  useHierarchyImpact,
  useHierarchyHistory,
  useMoveHierarchyNode,
  useOrganizationWorkspace,
  useOrganizationNodeDetail,
  useReactivateHierarchyNode,
  useRenameHierarchyNode,
  useRetiredHierarchy,
  useRetireHierarchyNode,
} from './hooks/use-organization'
import { HierarchyLevelStrip } from './hierarchy-level-strip'

/** Read-only organization workspace; guarded writes arrive after hierarchy invariants are proven. */
export function OrganizationPage() {
  const { t, i18n } = useTranslation()
  const workspace = useOrganizationWorkspace()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'create' | 'rename' | 'move' | 'retire' | 'reactivate' | null>(null)
  const [retiredId, setRetiredId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', name: '', nameAr: '', reason: '', targetParentId: '' })
  const createNode = useCreateHierarchyNode()
  const renameNode = useRenameHierarchyNode()
  const retireNode = useRetireHierarchyNode()
  const moveNode = useMoveHierarchyNode()
  const reactivateNode = useReactivateHierarchyNode()
  const retired = useRetiredHierarchy()
  const isArabic = i18n.language.startsWith('ar')

  useEffect(() => {
    if (!workspace.data || expanded.size > 0) return
    setExpanded(new Set(workspace.data.hierarchy.map((node) => node.id)))
  }, [workspace.data, expanded.size])

  const rows = useMemo(
    () => flattenOrganizationTree(workspace.data?.hierarchy ?? [], expanded),
    [workspace.data?.hierarchy, expanded],
  )
  const selected = rows.find((node) => node.id === selectedId) ?? rows[0] ?? null
  const detail = useOrganizationNodeDetail(selected?.id ?? null)
  const impact = useHierarchyImpact(
    selected?.id ?? null,
    dialog === 'retire' || (dialog === 'move' && Boolean(form.targetParentId)),
    dialog === 'move' ? form.targetParentId : undefined,
  )
  const moveTargets = useMemo(() => {
    if (!selected) return []
    return rows.filter(
      (node) =>
        node.levelIndex === selected.levelIndex - 1 &&
        node.id !== selected.parentId &&
        !node.path.startsWith(`${selected.path}.`),
    )
  }, [rows, selected])

  if (workspace.isLoading) {
    return <div className="h-[520px] animate-pulse rounded-[3px] bg-card" />
  }
  if (workspace.isError) {
    return (
      <EmptyState
        title={t('organization.loadFailed')}
        description={t('organization.loadFailedBody')}
        action={<Button onClick={() => void workspace.refetch()}>{t('common.retry')}</Button>}
      />
    )
  }
  if (!workspace.data) return null

  const { organization, quality } = workspace.data
  const handleTreeKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    node: OrganizationHierarchyNode & { depth: number },
    open: boolean,
  ) => {
    const items = Array.from(
      event.currentTarget.closest('[role="tree"]')?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [],
    )
    const index = items.indexOf(event.currentTarget)
    const focusAt = (target: number) => items[target]?.focus()
    if (event.key === 'ArrowDown') { event.preventDefault(); focusAt(Math.min(index + 1, items.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusAt(Math.max(index - 1, 0)) }
    else if (event.key === 'Home') { event.preventDefault(); focusAt(0) }
    else if (event.key === 'End') { event.preventDefault(); focusAt(items.length - 1) }
    else if (event.key === 'ArrowRight' && node.children.length && !open) {
      event.preventDefault(); setExpanded((current) => new Set([...current, node.id]))
    } else if (event.key === 'ArrowLeft' && open) {
      event.preventDefault(); setExpanded((current) => { const next = new Set(current); next.delete(node.id); return next })
    } else if (event.key === 'ArrowLeft' && node.parentId) {
      event.preventDefault(); items.find((item) => item.dataset.nodeId === node.parentId)?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); setSelectedId(node.id)
    }
  }
  const openDialog = (kind: 'create' | 'rename' | 'move' | 'retire') => {
    setForm({
      code: '',
      name: kind === 'rename' ? selected?.name ?? '' : '',
      nameAr: kind === 'rename' ? selected?.nameAr ?? '' : '',
      reason: '',
      targetParentId: '',
    })
    setDialog(kind)
  }

  const reportError = (error: unknown) => {
    if (error instanceof ApiRequestError) {
      notify.danger(error.message, { description: error.reasons?.join(' · ') })
    } else notify.danger(t('organization.writeFailed'))
  }

  const submitDialog = async () => {
    if (!selected || !dialog) return
    try {
      if (dialog === 'create') {
        await createNode.mutateAsync({
          parentId: selected.id,
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          nameAr: form.nameAr.trim(),
          levelCode: nextLevelCode(selected.levelCode),
          levelLabel: nextLevelLabel(selected.levelLabel),
          reason: form.reason.trim(),
        })
        notify.ok(t('organization.nodeCreated'))
      } else if (dialog === 'rename') {
        await renameNode.mutateAsync({
          nodeId: selected.id,
          input: {
            expectedRevision: selected.revision,
            name: form.name.trim(),
            nameAr: form.nameAr.trim(),
            reason: form.reason.trim(),
          },
        })
        notify.ok(t('organization.nodeRenamed'))
      } else if (dialog === 'move') {
        if (!impact.data) return
        await moveNode.mutateAsync({
          nodeId: selected.id,
          targetParentId: form.targetParentId,
          revision: selected.revision,
          impactToken: impact.data.impactToken,
          reason: form.reason.trim(),
        })
        notify.ok(t('organization.nodeMoved'))
      } else if (dialog === 'retire') {
        await retireNode.mutateAsync({
          nodeId: selected.id,
          revision: selected.revision,
          reason: form.reason.trim(),
        })
        setSelectedId(null)
        notify.ok(t('organization.nodeRetired'))
      } else {
        const target = retired.data?.find((node) => node.id === retiredId)
        if (!target) return
        await reactivateNode.mutateAsync({ nodeId: target.id, revision: target.revision, reason: form.reason.trim() })
        notify.ok(t('organization.nodeReactivated'))
      }
      setDialog(null)
    } catch (error) { reportError(error) }
  }

  const pending = createNode.isPending || renameNode.isPending || retireNode.isPending || moveNode.isPending || reactivateNode.isPending
  const invalid =
    !form.reason.trim() ||
    (dialog === 'create' && (!form.code.trim() || !form.name.trim() || !form.nameAr.trim())) ||
    (dialog === 'rename' && (!form.name.trim() || !form.nameAr.trim())) ||
    (dialog === 'move' && (!form.targetParentId || impact.isLoading || !impact.data)) ||
    (dialog === 'retire' && (impact.isLoading || impact.data?.blocking !== false))
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('organization.eyebrow')}
        title={t('organization.title')}
        description={t('organization.description')}
      />

      <HierarchyLevelStrip levels={workspace.data.levels} organizationRevision={workspace.data.organization.revision} />

      {!quality.healthy ? (
        <div className="flex gap-3 rounded-[3px] border border-warning/40 bg-warning/10 p-4 text-warning">
          <TriangleAlert className="mt-0.5 size-5" aria-hidden="true" />
          <div>
            <p className="font-bold">{t('organization.qualityWarning')}</p>
            <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">
              {quality.reasons.map((reason) => <li key={reason}>{qualityReason(reason, t)}</li>)}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('organization.nodes')} value={String(quality.activeNodes)} icon={GitBranch} iconTone="brand" />
        <StatCard label={t('organization.roots')} value={String(quality.activeRoots)} icon={Building2} iconTone={quality.activeRoots === 1 ? 'ok' : 'warn'} />
        <StatCard label={t('organization.roles')} value={String(quality.activeRoleAssignments)} icon={ShieldCheck} iconTone="info" />
        <StatCard label={t('organization.homeScopeGaps')} value={String(quality.peopleWithoutHomeScope)} icon={Users} iconTone={quality.peopleWithoutHomeScope === 0 ? 'ok' : 'warn'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-[3px] border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="eyebrow">{organization.code} · v{organization.revision}</p>
              <h2 className="mt-1 text-base font-bold">{t('organization.structure')}</h2>
            </div>
            <div className="flex items-center gap-6 text-end text-[10px] font-bold uppercase text-muted-foreground"><span>{t('organization.vehicles')}</span><span>{t('organization.users')}</span></div>
          </div>
          <div role="tree" aria-label={t('organization.structure')} className="divide-y divide-border">
            {rows.map((node) => {
              const open = expanded.has(node.id)
              const label = isArabic ? node.nameAr : node.name
              return (
                <div
                  key={node.id}
                  role="treeitem"
                  data-node-id={node.id}
                  tabIndex={selected?.id === node.id ? 0 : -1}
                  aria-level={node.depth + 1}
                  aria-expanded={node.children.length ? open : undefined}
                  aria-selected={selected?.id === node.id}
                  onFocus={() => setSelectedId(node.id)}
                  onKeyDown={(event) => handleTreeKeyDown(event, node, open)}
                  className={cn(
                    'flex min-h-12 items-center gap-2 px-3 transition-colors',
                    selected?.id === node.id ? 'bg-brand-soft' : 'hover:bg-surface-hover',
                  )}
                  style={{ paddingInlineStart: `${12 + node.depth * 24}px` }}
                >
                  {node.children.length ? (
                    <button
                      type="button"
                      aria-label={open ? t('organization.collapseNode', { name: label }) : t('organization.expandNode', { name: label })}
                      onClick={() => setExpanded((current) => {
                        const next = new Set(current)
                        if (next.has(node.id)) next.delete(node.id)
                        else next.add(node.id)
                        return next
                      })}
                      className="grid size-8 shrink-0 place-items-center rounded-[2px] hover:bg-surface-2"
                    >
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4 rtl:rotate-180" />}
                    </button>
                  ) : <span className="size-8" />}
                  <button type="button" onClick={() => setSelectedId(node.id)} className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2 text-start">
                    <span className="min-w-0"><span className="block truncate text-sm font-bold">{label}</span><span className="font-data text-[11px] text-muted-foreground">{node.code}</span></span>
                    <span className="flex shrink-0 items-center gap-3"><StatusChip tone="neutral" label={node.levelCode} /><span className="w-10 text-end font-data text-xs">{node.vehicleCount}</span><span className="w-10 text-end font-data text-xs">{node.userCount}</span></span>
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <NodeDetails
          node={selected}
          detail={detail.data ?? null}
          organizationName={organization.name}
          isArabic={isArabic}
          onCreate={() => openDialog('create')}
          onRename={() => openDialog('rename')}
          onMove={() => openDialog('move')}
          onRetire={() => openDialog('retire')}
        />
      </div>

      {retired.data?.length ? (
        <section className="rounded-[3px] border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2"><Archive className="size-4" /><h2 className="font-bold">{t('organization.retiredNodes')}</h2></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {retired.data.map((node) => (
              <div key={node.id} className="flex items-center justify-between gap-3 rounded-[3px] border border-border p-3">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{isArabic ? node.nameAr : node.name}</p><p className="font-data text-xs text-muted-foreground">{node.code} · v{node.revision}</p></div>
                <Button size="sm" variant="secondary" onClick={() => { setRetiredId(node.id); setForm({ code: '', name: '', nameAr: '', reason: '', targetParentId: '' }); setDialog('reactivate') }}>{t('organization.reactivate')}</Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent dir={isArabic ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t(`organization.dialog.${dialog ?? 'create'}.title`)}</DialogTitle>
            <DialogDescription>
              {dialog === 'retire'
                ? t('organization.dialog.retire.description')
                : t('organization.dialog.description', { name: selected ? (isArabic ? selected.nameAr : selected.name) : '' })}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'create' ? (
            <Field label={t('organization.code')}><Input value={form.code} onChange={(event) => setForm((value) => ({ ...value, code: event.target.value.toUpperCase() }))} /></Field>
          ) : null}
          {dialog === 'create' || dialog === 'rename' ? (
            <>
              <Field label={t('organization.nameEn')}><Input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></Field>
              <Field label={t('organization.nameAr')}><Input dir="rtl" value={form.nameAr} onChange={(event) => setForm((value) => ({ ...value, nameAr: event.target.value }))} /></Field>
            </>
          ) : null}
          {dialog === 'move' ? (
            <Field label={t('organization.targetParent')}>
              <Select value={form.targetParentId} onValueChange={(targetParentId) => setForm((value) => ({ ...value, targetParentId }))}>
                <SelectTrigger><SelectValue placeholder={t('organization.selectTargetParent')} /></SelectTrigger>
                <SelectContent>{moveTargets.map((node) => <SelectItem key={node.id} value={node.id}>{isArabic ? node.nameAr : node.name} · {node.code}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          ) : null}
          {(dialog === 'retire' || dialog === 'move') && impact.data ? (
            <div className={cn('rounded-[3px] border p-3 text-sm', impact.data.blocking ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-success/40 bg-success/10 text-success')}>
              {impact.data.blocking
                ? t('organization.impactBlocked', { count: impact.data.reasons.length })
                : t('organization.impactClear')}
              {impact.data.reasons.length ? <ul className="mt-2 list-disc ps-5">{impact.data.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
            </div>
          ) : null}
          <Field label={t('organization.reason')}><Input value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} /></Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
            <Button variant={dialog === 'retire' ? 'destructive' : 'default'} disabled={invalid || pending} onClick={() => void submitDialog()}>
              {t(`organization.dialog.${dialog ?? 'create'}.confirm`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NodeDetails({ node, detail, organizationName, isArabic, onCreate, onRename, onMove, onRetire }: { node: OrganizationHierarchyNode | null; detail: OrganizationNodeDetail | null; organizationName: string; isArabic: boolean; onCreate: () => void; onRename: () => void; onMove: () => void; onRetire: () => void }) {
  const { t } = useTranslation()
  const history = useHierarchyHistory(node?.id ?? null)
  if (!node) return <EmptyState title={t('organization.noNodes')} description={t('organization.noNodesBody')} />
  return (
    <aside className="h-fit rounded-[3px] border border-border bg-card p-5">
      <p className="eyebrow">{node.levelCode}</p>
      <h2 className="mt-1 text-lg font-bold">{isArabic ? node.nameAr : node.name}</h2>
      <p className="mt-1 font-data text-xs text-muted-foreground">{node.code}{node.parentName ? ` · ${t('organization.parent')}: ${node.parentName}` : ''}</p>
      <div className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border py-3 rtl:divide-x-reverse">
        <Metric label={t('organization.vehicles')} value={node.vehicleCount} />
        <Metric label={t('organization.users')} value={node.userCount} />
        <Metric label={t('organization.utilization')} value={`${node.utilizationPercent}%`} />
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <Detail label={t('organization.code')} value={node.code} mono />
        <Detail label={t('organization.organization')} value={organizationName} />
        <Detail label={t('organization.level')} value={`${node.levelLabel} · ${node.levelIndex}`} />
        <Detail label={t('organization.path')} value={node.path} mono />
        <Detail label={t('organization.children')} value={String(node.childCount)} />
        <Detail label={t('organization.revision')} value={String(node.revision)} />
      </dl>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <Button variant="secondary" onClick={onCreate}><Plus />{t('organization.addChild')}</Button>
        <Button variant="secondary" onClick={onRename}><Pencil />{t('organization.rename')}</Button>
        {node.parentId ? <Button variant="secondary" onClick={onMove}><MoveRight />{t('organization.move')}</Button> : null}
        <Button variant="destructive" onClick={onRetire}><Archive />{t('organization.retire')}</Button>
      </div>
      {history.data?.length ? (
        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold"><History className="size-4" />{t('organization.history')}</div>
          <ol className="space-y-2">{history.data.slice(0, 6).map((event) => <li key={event.id} className="text-xs"><span className="font-bold">{event.action}</span><span className="text-muted-foreground"> · {new Date(event.atUtc).toLocaleString()}</span>{event.reason ? <p className="text-muted-foreground">{event.reason}</p> : null}</li>)}</ol>
        </div>
      ) : null}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-xs font-bold uppercase text-muted-foreground">{t('organization.scopedRoles')}</h3>
        {detail?.scopedRoles.length ? <ul className="mt-2 space-y-2">{detail.scopedRoles.slice(0, 5).map((role) => <li key={role.assignmentId} className="flex items-center justify-between gap-2 text-xs"><span className="truncate font-semibold">{role.fullName}</span><StatusChip tone="neutral" label={role.role} /></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">{t('organization.noDirectRoles')}</p>}
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-xs font-bold uppercase text-muted-foreground">{t('organization.recentTransfers')}</h3>
        {detail?.recentTransfers.length ? <ul className="mt-2 space-y-2">{detail.recentTransfers.slice(0, 4).map((transfer) => <li key={transfer.id} className="text-xs"><span className="font-data font-bold">{transfer.plate}</span><p className="text-muted-foreground">{transfer.fromCode ?? '—'} → {transfer.toCode}</p></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">{t('organization.noRecentTransfers')}</p>}
      </div>
      <div className="mt-5 rounded-[3px] border border-dashed border-border bg-surface-2 p-3 text-xs text-muted-foreground">
        {t('organization.writeGovernanceNote')}
      </div>
    </aside>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="px-2 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-data text-xl font-bold">{value}</p></div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-bold"><span>{label}</span>{children}</label>
}

function nextLevelCode(levelCode: string): string {
  return ({ GROUP: 'CLUSTER', CLUSTER: 'POOL', POOL: 'LOCATION' } as Record<string, string>)[levelCode] ?? 'LOCATION'
}

function nextLevelLabel(levelLabel: string): string {
  return ({ Group: 'Cluster', Cluster: 'Pool', Pool: 'Location' } as Record<string, string>)[levelLabel] ?? 'Location'
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-xs font-bold text-muted-foreground">{label}</dt><dd className={cn('mt-0.5 break-words', mono && 'font-data')}>{value}</dd></div>
}

function qualityReason(reason: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const [code, value] = reason.split(/:(?=[^:]+$)/)
  const key = `organization.quality.${code}`
  const translated = t(key, { count: Number(value) || value })
  return translated === key ? reason : translated
}
