/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- Native pointer drag lives on semantic cards; labeled arrow buttons provide the complete keyboard path. */
import { Fragment, useState } from 'react'
import { ArrowLeft, ArrowRight, Boxes, Building2, GitBranch, Layers, MapPin, Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ApiRequestError } from '@/lib/api-client'
import { notify } from '@/hooks/use-toast'
import type { OrganizationHierarchyLevel } from './organization.contract'
import { useCreateHierarchyLevel, useReorderHierarchyLevels, useUpdateHierarchyLevel } from './hooks/use-organization'
import { levelTone } from './level-tones'

/** Per-level icon; cycles alongside the shared colour tone so the strip stays N-level. */
const LEVEL_ICONS = [Building2, Layers, MapPin, Boxes] as const

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
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-brand" aria-hidden="true" />
          <p className="eyebrow">{t('organization.levels.title')}</p>
          <span className="rounded-[3px] bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {t('organization.levels.inUse', { count: levels.length })}
          </span>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">{t('organization.levels.reuseNote')}</p>
      </div>
      <section className="flex items-stretch gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]" aria-label={t('organization.levels.title')}>
        {levels.map((level, index) => {
          const tone = levelTone(index)
          const Icon = LEVEL_ICONS[index % LEVEL_ICONS.length]
          return (
            <Fragment key={level.code}>
              <article
                draggable
                aria-label={`${isArabic ? level.labelAr : level.labelEn}, ${t('organization.levels.level', { count: index + 1 })}`}
                onDragStart={() => setDragCode(level.code)}
                onDragEnd={() => setDragCode(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropOn(level.code)}
                className="group relative flex min-w-40 flex-col overflow-hidden rounded-[3px] border border-border bg-card p-2.5 pt-3"
              >
                <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', tone.bar)} />
                <div className="flex items-start gap-2">
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-[3px]', tone.soft, tone.text)}><Icon className="size-3.5" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[10px] font-bold uppercase tracking-wide', tone.text)}>{t('organization.levels.level', { count: index + 1 })}</p>
                    <p className="truncate text-sm font-bold">{isArabic ? level.labelAr : level.labelEn}</p>
                  </div>
                </div>
                <div className="absolute end-1 top-1.5 flex gap-0.5 rounded-[3px] bg-card/80 opacity-0 backdrop-blur-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="size-6" aria-label={t('organization.levels.movePrevious')} disabled={index === 0 || reorder.isPending} onClick={() => move(level.code, -1)}>{isArabic ? <ArrowRight /> : <ArrowLeft />}</Button>
                  <Button size="icon" variant="ghost" className="size-6" aria-label={t('organization.levels.edit')} onClick={() => open(level)}><Pencil /></Button>
                  <Button size="icon" variant="ghost" className="size-6" aria-label={t('organization.levels.moveNext')} disabled={index === levels.length - 1 || reorder.isPending} onClick={() => move(level.code, 1)}>{isArabic ? <ArrowLeft /> : <ArrowRight />}</Button>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground"><span className={cn('font-bold', tone.text)}>{level.nodeCount}</span> {t('organization.levels.nodeUnit')}</span>
                  {level.mandatory
                    ? <span className="rounded-[3px] bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{t('organization.levels.mandatory')}</span>
                    : <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{t('organization.levels.optional')}</span>}
                </div>
              </article>
              <div className="flex shrink-0 items-center text-muted-foreground/50" aria-hidden="true">{isArabic ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}</div>
            </Fragment>
          )
        })}
        <button
          type="button"
          onClick={() => open('new')}
          className="flex min-w-40 flex-col items-center justify-center gap-1 rounded-[3px] border border-dashed border-border bg-transparent p-2.5 text-muted-foreground transition-colors hover:border-brand hover:text-brand focus-visible:border-brand focus-visible:text-brand focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="text-sm font-semibold">{t('organization.levels.addNext', { count: levels.length + 1 })}</span>
        </button>
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
