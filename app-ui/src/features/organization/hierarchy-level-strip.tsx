/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- Native pointer drag lives on semantic cards; labeled arrow buttons provide the complete keyboard path. */
import { useState } from 'react'
import { ArrowLeft, ArrowRight, GripVertical, Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ApiRequestError } from '@/lib/api-client'
import { notify } from '@/hooks/use-toast'
import type { OrganizationHierarchyLevel } from './organization.contract'
import { useCreateHierarchyLevel, useReorderHierarchyLevels, useUpdateHierarchyLevel } from './hooks/use-organization'

interface Props {
  levels: OrganizationHierarchyLevel[]
  organizationRevision: number
}

/** Organization-specific hierarchy level editor with drag and keyboard reorder. */
export function HierarchyLevelStrip({ levels, organizationRevision }: Props) {
  const { t, i18n } = useTranslation()
  const [dragCode, setDragCode] = useState<string | null>(null)
  const [editing, setEditing] = useState<OrganizationHierarchyLevel | 'new' | null>(null)
  const [form, setForm] = useState({ code: '', labelEn: '', labelAr: '', reason: '' })
  const reorder = useReorderHierarchyLevels()
  const create = useCreateHierarchyLevel()
  const update = useUpdateHierarchyLevel()
  const isArabic = i18n.language.startsWith('ar')

  const report = (error: unknown) => {
    if (error instanceof ApiRequestError) notify.danger(error.message, { description: error.reasons?.join(' · ') })
    else notify.danger(t('organization.levels.saveFailed'))
  }

  const commitOrder = async (orderedCodes: string[]) => {
    try {
      await reorder.mutateAsync({ orderedCodes, expectedOrganizationRevision: organizationRevision, reason: 'Hierarchy level order changed in Organization Management' })
      notify.ok(t('organization.levels.reordered'))
    } catch (error) { report(error) }
  }

  const move = (code: string, delta: number) => {
    const current = levels.map((level) => level.code)
    const from = current.indexOf(code)
    const to = from + delta
    if (to < 0 || to >= current.length) return
    const next = [...current]
    ;[next[from], next[to]] = [next[to], next[from]]
    void commitOrder(next)
  }

  const dropOn = (targetCode: string) => {
    if (!dragCode || dragCode === targetCode) return
    const current = levels.map((level) => level.code)
    const from = current.indexOf(dragCode)
    const to = current.indexOf(targetCode)
    const next = [...current]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDragCode(null)
    void commitOrder(next)
  }

  const open = (level: OrganizationHierarchyLevel | 'new') => {
    setEditing(level)
    setForm(level === 'new' ? { code: '', labelEn: '', labelAr: '', reason: '' } : { code: level.code, labelEn: level.labelEn, labelAr: level.labelAr, reason: '' })
  }

  const save = async () => {
    try {
      if (editing === 'new') {
        await create.mutateAsync({ code: form.code.trim().toUpperCase().replaceAll('-', '_'), labelEn: form.labelEn.trim(), labelAr: form.labelAr.trim(), reason: form.reason.trim() })
        notify.ok(t('organization.levels.created'))
      } else if (editing) {
        await update.mutateAsync({ levelId: editing.id, input: { expectedRevision: editing.revision, labelEn: form.labelEn.trim(), labelAr: form.labelAr.trim(), reason: form.reason.trim() } })
        notify.ok(t('organization.levels.updated'))
      }
      setEditing(null)
    } catch (error) { report(error) }
  }

  const normalizedCode = form.code.trim().toUpperCase().replaceAll('-', '_')
  const invalid = !form.labelEn.trim() || !form.labelAr.trim() || !form.reason.trim() || (editing === 'new' && (!normalizedCode || levels.some((level) => level.code === normalizedCode)))

  return (
    <section className="rounded-[3px] border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><p className="eyebrow">{t('organization.levels.eyebrow')}</p><p className="mt-1 text-xs text-muted-foreground">{t('organization.levels.description')}</p></div>
        {levels.length < 5 ? <Button size="sm" variant="secondary" onClick={() => open('new')}><Plus />{t('organization.levels.add')}</Button> : null}
      </div>
      <section className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]" aria-label={t('organization.levels.title')}>
        {levels.map((level, index) => (
          <article
            key={level.code}
            draggable
            aria-label={`${isArabic ? level.labelAr : level.labelEn}, ${t('organization.levels.level', { count: index + 1 })}`}
            onDragStart={() => setDragCode(level.code)}
            onDragEnd={() => setDragCode(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropOn(level.code)}
            className="group flex min-w-44 items-center gap-2 rounded-[3px] border border-border bg-surface-2 p-3"
          >
            <GripVertical className="size-4 cursor-grab text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase text-brand">{t('organization.levels.level', { count: index + 1 })} · {level.mandatory ? t('organization.levels.mandatory') : t('organization.levels.optional')}</p><p className="truncate text-sm font-bold">{isArabic ? level.labelAr : level.labelEn}</p><p className="text-xs text-muted-foreground">{t('organization.levels.nodeCount', { count: level.nodeCount })}</p></div>
            <div className="flex flex-col gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <Button size="icon" variant="ghost" aria-label={t('organization.levels.movePrevious')} disabled={index === 0 || reorder.isPending} onClick={() => move(level.code, -1)}>{isArabic ? <ArrowRight /> : <ArrowLeft />}</Button>
              <Button size="icon" variant="ghost" aria-label={t('organization.levels.edit')} onClick={() => open(level)}><Pencil /></Button>
              <Button size="icon" variant="ghost" aria-label={t('organization.levels.moveNext')} disabled={index === levels.length - 1 || reorder.isPending} onClick={() => move(level.code, 1)}>{isArabic ? <ArrowLeft /> : <ArrowRight />}</Button>
            </div>
          </article>
        ))}
      </section>

      <Dialog open={editing !== null} onOpenChange={(value) => !value && setEditing(null)}>
        <DialogContent dir={isArabic ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{editing === 'new' ? t('organization.levels.add') : t('organization.levels.edit')}</DialogTitle><DialogDescription>{t('organization.levels.dialogDescription')}</DialogDescription></DialogHeader>
          {editing === 'new' ? <label className="grid gap-1 text-sm font-bold">{t('organization.code')}<Input value={form.code} onChange={(event) => setForm((value) => ({ ...value, code: event.target.value }))} /></label> : null}
          <label className="grid gap-1 text-sm font-bold">{t('organization.nameEn')}<Input value={form.labelEn} onChange={(event) => setForm((value) => ({ ...value, labelEn: event.target.value }))} /></label>
          <label className="grid gap-1 text-sm font-bold">{t('organization.nameAr')}<Input dir="rtl" value={form.labelAr} onChange={(event) => setForm((value) => ({ ...value, labelAr: event.target.value }))} /></label>
          <label className="grid gap-1 text-sm font-bold">{t('organization.reason')}<Input value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} /></label>
          <DialogFooter><Button variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button disabled={invalid || create.isPending || update.isPending} onClick={() => void save()}>{t('common.save')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
