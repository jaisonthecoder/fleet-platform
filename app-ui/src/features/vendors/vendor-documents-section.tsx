import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FileCheck2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusChip } from '@/components/ui/status-chip'
import { useAuth } from '@/features/auth/auth-context'
import { useLookupValues } from '@/features/config/hooks/use-lookups'
import { notify } from '@/hooks/use-toast'
import { ApiRequestError } from '@/lib/api-client'
import {
  useConfirmVendorDocument,
  useCreateVendorDocument,
  useRejectVendorDocument,
  useVendorDocuments,
} from './hooks/use-vendors'
import type {
  CreateVendorDocumentInput,
  Vendor,
  VendorDocumentStatus,
} from './vendors.contract'

const DOCUMENT_STATUS_TONE: Record<
  VendorDocumentStatus,
  'ok' | 'warn' | 'neutral'
> = {
  Uploaded: 'neutral',
  PendingConfirmation: 'warn',
  Confirmed: 'ok',
  Superseded: 'neutral',
  Rejected: 'warn',
}

const CONFIGURE_ROLES = new Set(['SystemAdmin', 'DataSteward', 'Procurement'])
const CONFIRM_ROLES = new Set(['DataSteward', 'Procurement'])

/** Renders immutable Vendor document versions and manual evidence actions. */
export function VendorDocumentsSection({ vendor }: { vendor: Vendor }) {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const documents = useVendorDocuments(vendor.id)
  const createDocument = useCreateVendorDocument(vendor.id)
  const confirmDocument = useConfirmVendorDocument(vendor.id)
  const rejectDocument = useRejectVendorDocument(vendor.id)
  const documentTypes = useLookupValues('vendor-document-type')
  const [formOpen, setFormOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const heldRoles = new Set(me?.roles.map((role) => role.role) ?? [])
  const isIntegrated = vendor.sourceMode === 'Integrated'
  const canConfigure =
    !isIntegrated && [...CONFIGURE_ROLES].some((role) => heldRoles.has(role))
  const canConfirm =
    !isIntegrated && [...CONFIRM_ROLES].some((role) => heldRoles.has(role))

  /** Displays a stable API reason without claiming success. */
  const reportError = (error: unknown, fallback: string) => {
    if (error instanceof ApiRequestError) {
      notify.danger(error.message || fallback, {
        description: error.reasons?.join(' · '),
      })
      return
    }
    notify.danger(fallback)
  }

  return (
    <section className="mt-8" aria-labelledby="vendor-documents-heading">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 id="vendor-documents-heading" className="eyebrow">
          {t('vendors.documents.title')}
        </h3>
        {canConfigure ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setFormOpen((open) => !open)}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('vendors.documents.add')}
          </Button>
        ) : null}
      </div>

      <p className="text-ink-3 mb-3 text-xs">
        {t('vendors.documents.manualOnly')}
      </p>

      {formOpen ? (
        <VendorDocumentForm
          pending={createDocument.isPending}
          onCancel={() => setFormOpen(false)}
          onSubmit={async (input) => {
            try {
              await createDocument.mutateAsync(input)
              setFormOpen(false)
              notify.ok(t('vendors.documents.created'))
            } catch (error) {
              reportError(error, t('vendors.documents.createFailed'))
            }
          }}
        />
      ) : null}

      {documents.isLoading ? (
        <p className="text-ink-3 text-sm">{t('common.loading')}</p>
      ) : documents.isError ? (
        <div className="space-y-2 text-sm">
          <p className="text-destructive">
            {t('vendors.documents.loadFailed')}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => documents.refetch()}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : documents.data?.length ? (
        <ul className="space-y-2">
          {documents.data.map((document) => {
            const type = documentTypes.data?.find(
              (item) => item.code === document.documentTypeCode,
            )
            const label = (i18n.resolvedLanguage ?? i18n.language).startsWith(
              'ar',
            )
              ? type?.labelAr
              : type?.labelEn
            const isPending = ['Uploaded', 'PendingConfirmation'].includes(
              document.status,
            )
            return (
              <li
                key={document.id}
                className="border-border rounded-md border p-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {label ?? document.documentTypeCode}
                    </p>
                    <p className="text-ink-3 font-data text-xs">
                      {t('vendors.documents.version', {
                        version: document.version,
                      })}
                      {document.documentReference
                        ? ` · ${document.documentReference}`
                        : ''}
                    </p>
                  </div>
                  <StatusChip
                    tone={DOCUMENT_STATUS_TONE[document.status]}
                    label={t(`vendors.documents.status.${document.status}`)}
                  />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-3">
                      {t('vendors.documents.fields.issueDate')}
                    </dt>
                    <dd className="font-data">{document.issueDate ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">
                      {t('vendors.documents.fields.expiryDate')}
                    </dt>
                    <dd className="font-data">{document.expiryDate ?? '—'}</dd>
                  </div>
                </dl>
                {isPending && canConfirm ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await confirmDocument.mutateAsync({
                              documentId: document.id,
                              input: {
                                confirmedMetadata: { manuallyConfirmed: true },
                              },
                            })
                            notify.ok(t('vendors.documents.confirmed'))
                          } catch (error) {
                            reportError(
                              error,
                              t('vendors.documents.confirmFailed'),
                            )
                          }
                        }}
                      >
                        {t('vendors.documents.confirm')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRejectingId(document.id)}
                      >
                        {t('vendors.documents.reject')}
                      </Button>
                    </div>
                    {rejectingId === document.id ? (
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={async (event) => {
                          event.preventDefault()
                          if (!rejectReason.trim()) return
                          try {
                            await rejectDocument.mutateAsync({
                              documentId: document.id,
                              reason: rejectReason.trim(),
                            })
                            setRejectingId(null)
                            setRejectReason('')
                            notify.ok(t('vendors.documents.rejected'))
                          } catch (error) {
                            reportError(
                              error,
                              t('vendors.documents.rejectFailed'),
                            )
                          }
                        }}
                      >
                        <Label
                          htmlFor={`reject-${document.id}`}
                          className="sr-only"
                        >
                          {t('vendors.documents.rejectReason')}
                        </Label>
                        <Input
                          id={`reject-${document.id}`}
                          value={rejectReason}
                          onChange={(event) =>
                            setRejectReason(event.target.value)
                          }
                          placeholder={t('vendors.documents.rejectReason')}
                          className="min-w-52 flex-1"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="destructive"
                          disabled={!rejectReason.trim()}
                        >
                          {t('common.confirm')}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="border-border grid justify-items-center gap-1 rounded-md border border-dashed p-4 text-center">
          <FileCheck2 className="text-ink-3 size-6" aria-hidden="true" />
          <p className="text-sm font-medium">{t('vendors.documents.empty')}</p>
        </div>
      )}
    </section>
  )
}

interface VendorDocumentFormProps {
  pending: boolean
  onCancel: () => void
  onSubmit: (input: CreateVendorDocumentInput) => void
}

/** Captures manual Vendor document metadata without claiming OCR processing. */
function VendorDocumentForm({
  pending,
  onCancel,
  onSubmit,
}: VendorDocumentFormProps) {
  const { t, i18n } = useTranslation()
  const documentTypes = useLookupValues('vendor-document-type')
  const [documentTypeCode, setDocumentTypeCode] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [blobRef, setBlobRef] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!documentTypeCode || !blobRef.trim()) return
    onSubmit({
      documentTypeCode,
      documentReference: documentReference.trim() || undefined,
      blobRef: blobRef.trim(),
      issueDate: issueDate || undefined,
      expiryDate: expiryDate || undefined,
    })
  }

  return (
    <form
      className="border-border mb-4 space-y-3 rounded-md border p-3"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="vendor-document-type">
          {t('vendors.documents.fields.type')}
        </Label>
        <Select value={documentTypeCode} onValueChange={setDocumentTypeCode}>
          <SelectTrigger id="vendor-document-type">
            <SelectValue placeholder={t('vendors.documents.selectType')} />
          </SelectTrigger>
          <SelectContent>
            {(documentTypes.data ?? []).map((type) => (
              <SelectItem key={type.id} value={type.code}>
                {(i18n.resolvedLanguage ?? i18n.language).startsWith('ar')
                  ? type.labelAr
                  : type.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DocumentInput
        id="vendor-document-reference"
        label={t('vendors.documents.fields.reference')}
        value={documentReference}
        onChange={setDocumentReference}
      />
      <DocumentInput
        id="vendor-document-blob"
        label={t('vendors.documents.fields.storageReference')}
        value={blobRef}
        onChange={setBlobRef}
        required
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <DocumentInput
          id="vendor-document-issue-date"
          label={t('vendors.documents.fields.issueDate')}
          value={issueDate}
          onChange={setIssueDate}
          type="date"
        />
        <DocumentInput
          id="vendor-document-expiry-date"
          label={t('vendors.documents.fields.expiryDate')}
          value={expiryDate}
          onChange={setExpiryDate}
          type="date"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={pending || !documentTypeCode || !blobRef.trim()}
        >
          {t('vendors.documents.create')}
        </Button>
      </div>
    </form>
  )
}

interface DocumentInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date'
  required?: boolean
}

/** Renders one labelled Vendor document field. */
function DocumentInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: DocumentInputProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  )
}
