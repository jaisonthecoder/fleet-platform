import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, Pencil, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusChip } from '@/components/ui/status-chip'
import { notify } from '@/hooks/use-toast'
import type {
  CredentialField,
  CredentialStatus,
  MyCredentials,
  UpdateCredentialsInput,
} from './credential.contract'

/** Maps a credential status to a StatusChip tone (colour is never the only cue). */
function statusTone(status: CredentialStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Valid') return 'ok'
  if (status === 'ExpiringSoon') return 'warn'
  if (status === 'Expired') return 'danger'
  return 'neutral'
}

interface CredentialPanelProps {
  credentials: MyCredentials
  onSave: (input: UpdateCredentialsInput) => Promise<unknown>
  saving: boolean
  /** Heading for the panel (self vs admin context). */
  title: string
}

/**
 * Reusable driver-credential panel: shows licence + Emirates ID status with an
 * inline capture form. Used for self-service (profile) and admin (person) entry.
 */
export function CredentialPanel({
  credentials,
  onSave,
  saving,
  title,
}: CredentialPanelProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const [editing, setEditing] = useState(false)
  const [licenceNumber, setLicenceNumber] = useState('')
  const [licenceExpiry, setLicenceExpiry] = useState('')
  const [emiratesId, setEmiratesId] = useState('')
  const [emiratesIdExpiry, setEmiratesIdExpiry] = useState('')

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
          new Date(`${value}T00:00:00Z`),
        )
      : '—'

  function beginEdit() {
    setLicenceNumber(credentials.licence.number ?? '')
    setLicenceExpiry(credentials.licence.expiry ?? '')
    setEmiratesId(credentials.emiratesId.number ?? '')
    setEmiratesIdExpiry(credentials.emiratesId.expiry ?? '')
    setEditing(true)
  }

  async function save() {
    const input: UpdateCredentialsInput = {}
    if (licenceNumber.trim()) input.licenceNumber = licenceNumber.trim()
    if (licenceExpiry) input.licenceExpiry = licenceExpiry
    if (emiratesId.trim()) input.emiratesId = emiratesId.trim()
    if (emiratesIdExpiry) input.emiratesIdExpiry = emiratesIdExpiry
    if (Object.keys(input).length === 0) {
      setEditing(false)
      return
    }
    try {
      await onSave(input)
      notify.ok(t('profile.credentials.saved'))
      setEditing(false)
    } catch {
      notify.danger(t('profile.credentials.saveFailed'))
    }
  }

  const rows: Array<{ key: 'licence' | 'emiratesId'; field: CredentialField }> = [
    { key: 'licence', field: credentials.licence },
    { key: 'emiratesId', field: credentials.emiratesId },
  ]

  return (
    <section className="rounded-[3px] border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        {!editing ? (
          <Button variant="secondary" size="sm" onClick={beginEdit}>
            <Pencil aria-hidden="true" />
            {t('profile.credentials.edit')}
          </Button>
        ) : null}
      </div>

      {!editing ? (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {rows.map(({ key, field }) => (
            <div key={key} className="rounded-[3px] border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <dt className="eyebrow">{t(`profile.credentials.${key}`)}</dt>
                <StatusChip
                  tone={statusTone(field.status)}
                  label={t(`profile.credentials.status.${field.status}`)}
                />
              </div>
              <dd className="mt-2 text-sm font-semibold">
                <bdi>{field.number ?? t('profile.credentials.notProvided')}</bdi>
              </dd>
              <dd className="mt-1 text-xs text-muted-foreground">
                {t('profile.credentials.expires', {
                  date: formatDate(field.expiry),
                })}
              </dd>
              {field.number && !field.verified ? (
                <dd className="mt-2 inline-flex items-center gap-1 text-xs text-warning">
                  <ShieldAlert className="size-3.5" aria-hidden="true" />
                  {t('profile.credentials.unverified')}
                </dd>
              ) : field.verified ? (
                <dd className="mt-2 inline-flex items-center gap-1 text-xs text-success">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  {t('profile.credentials.verified')}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cred-licence-number">
              {t('profile.credentials.licenceNumber')}
            </Label>
            <Input
              id="cred-licence-number"
              value={licenceNumber}
              onChange={(e) => setLicenceNumber(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-licence-expiry">
              {t('profile.credentials.licenceExpiry')}
            </Label>
            <Input
              id="cred-licence-expiry"
              type="date"
              value={licenceExpiry}
              onChange={(e) => setLicenceExpiry(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-eid-number">
              {t('profile.credentials.emiratesIdNumber')}
            </Label>
            <Input
              id="cred-eid-number"
              value={emiratesId}
              onChange={(e) => setEmiratesId(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-eid-expiry">
              {t('profile.credentials.emiratesIdExpiry')}
            </Label>
            <Input
              id="cred-eid-expiry"
              type="date"
              value={emiratesIdExpiry}
              onChange={(e) => setEmiratesIdExpiry(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              variant="secondary"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? t('profile.credentials.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
