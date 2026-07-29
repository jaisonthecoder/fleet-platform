import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileCheck2, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-context'
import { hasAnyRole } from '@/features/auth/roles'
import { ApiRequestError } from '@/lib/api-client'
import {
  activateConsentTemplate,
  createConsentTemplate,
  getConsentTemplates,
  retireConsentTemplate,
  type ConsentDomain,
  type ConsentTemplate,
} from './consent-administration.contract'

/** Manual governed consent authoring and explicit organizational activation. */
export function ConsentAdministrationPage() {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const queryClient = useQueryClient()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const canActivate = hasAnyRole(me, ['SystemAdmin'])
  const [domain, setDomain] = useState<ConsentDomain>('Booking')
  const [version, setVersion] = useState('')
  const [effectiveAt, setEffectiveAt] = useState('')
  const [contentEn, setContentEn] = useState('')
  const [contentAr, setContentAr] = useState('')
  const [validation, setValidation] = useState<string | null>(null)
  const versions = useQuery({ queryKey: ['admin', 'consents', domain], queryFn: () => getConsentTemplates(domain) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'consents'] })
  const create = useMutation({ mutationFn: createConsentTemplate, onSuccess: async () => { setVersion(''); setEffectiveAt(''); setContentEn(''); setContentAr(''); await refresh() } })
  const activate = useMutation({ mutationFn: activateConsentTemplate, onSuccess: refresh })
  const retire = useMutation({ mutationFn: retireConsentTemplate, onSuccess: refresh })

  /** Validates and creates an immutable Draft. */
  function saveDraft() {
    const effective = new Date(effectiveAt)
    if (!version.trim() || Number.isNaN(effective.getTime()) || contentEn.trim().length < 20 || contentAr.trim().length < 20) {
      setValidation(t('consentAdmin.validation'))
      return
    }
    setValidation(null)
    create.mutate({ domain, version: version.trim(), effectiveAtUtc: effective.toISOString(), content: { en: contentEn.trim(), ar: contentAr.trim() } })
  }

  const error = create.error ?? activate.error ?? retire.error
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t('consentAdmin.eyebrow')} title={t('consentAdmin.title')} description={t('consentAdmin.subtitle')} />
      <div className="border border-warning/40 bg-warning/5 p-4 text-sm">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" /><div><strong>{t('consentAdmin.approvalTitle')}</strong><p className="mt-1 text-muted-foreground">{t('consentAdmin.approvalBody')}</p></div></div>
      </div>
      <Segmented aria-label={t('consentAdmin.domain')} value={domain} onValueChange={(value) => setDomain(value as ConsentDomain)} options={[
        { value: 'Booking', label: t('consentAdmin.domains.Booking') },
        { value: 'DedicatedVehicle', label: t('consentAdmin.domains.DedicatedVehicle') },
      ]} />
      <div className="grid gap-5 xl:grid-cols-[minmax(360px,.8fr)_1.2fr]">
        <section className="border border-border bg-card p-5">
          <h2 className="font-bold">{t('consentAdmin.newVersion')}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="consent-version">{t('consentAdmin.version')}</Label><Input id="consent-version" className="mt-2" value={version} onChange={(event) => setVersion(event.target.value)} /></div>
            <div><Label htmlFor="consent-effective">{t('consentAdmin.effectiveAt')}</Label><Input id="consent-effective" className="mt-2" type="datetime-local" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} /></div>
          </div>
          <Label htmlFor="consent-en" className="mt-4 block">{t('consentAdmin.english')}</Label><Textarea id="consent-en" className="mt-2 min-h-40" value={contentEn} onChange={(event) => setContentEn(event.target.value)} />
          <Label htmlFor="consent-ar" className="mt-4 block">{t('consentAdmin.arabic')}</Label><Textarea id="consent-ar" className="mt-2 min-h-40 text-end" dir="rtl" value={contentAr} onChange={(event) => setContentAr(event.target.value)} />
          {validation && <p role="alert" className="mt-3 text-sm text-destructive">{validation}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error instanceof ApiRequestError ? error.message : t('consentAdmin.error')}</p>}
          <Button className="mt-4 w-full" disabled={create.isPending} onClick={saveDraft}><FileCheck2 />{t('consentAdmin.saveDraft')}</Button>
        </section>
        <section className="border border-border bg-card p-5">
          <h2 className="font-bold">{t('consentAdmin.versions')}</h2>
          {versions.isLoading ? <p className="mt-4 text-sm text-muted-foreground">{t('consentAdmin.loading')}</p> : versions.isError ? <p role="alert" className="mt-4 text-sm text-destructive">{t('consentAdmin.error')}</p> : !versions.data?.length ? <p className="mt-4 text-sm text-muted-foreground">{t('consentAdmin.empty')}</p> : (
            <div className="mt-4 space-y-3">{versions.data.map((item) => <VersionRow key={item.id} item={item} locale={locale} canActivate={canActivate} onActivate={() => activate.mutate(item.id)} onRetire={() => retire.mutate(item.id)} />)}</div>
          )}
        </section>
      </div>
    </div>
  )
}

function VersionRow({ item, locale, canActivate, onActivate, onRetire }: { item: ConsentTemplate; locale: string; canActivate: boolean; onActivate: () => void; onRetire: () => void }) {
  const { t } = useTranslation()
  return <article className="border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong><bdi>{item.version}</bdi></strong><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.effectiveAtUtc))}</p></div><Badge variant={item.status === 'Active' ? 'default' : 'secondary'}>{t(`consentAdmin.status.${item.status}`)}</Badge></div><p className="mt-3 line-clamp-2 text-sm">{item.content.en}</p><p dir="rtl" className="mt-2 line-clamp-2 text-end text-sm">{item.content.ar}</p><p className="mt-3 break-all font-mono text-[10px] text-muted-foreground"><bdi>{item.contentHash}</bdi></p>{canActivate && item.status === 'Draft' && <Button className="mt-3" size="sm" onClick={onActivate}><CheckCircle2 />{t('consentAdmin.activate')}</Button>}{canActivate && item.status === 'Active' && <Button className="mt-3" size="sm" variant="destructive" onClick={onRetire}>{t('consentAdmin.retire')}</Button>}</article>
}
