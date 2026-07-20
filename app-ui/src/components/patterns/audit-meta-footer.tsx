import { useTranslation } from 'react-i18next'

interface AuditMetaFooterProps {
  createdBy?: string | null
  createdAt?: string | null
  updatedBy?: string | null
  updatedAt?: string | null
}

function formatWhen(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

/** Muted "created / updated by · when" strip for governed records. Renders nothing if empty. */
export function AuditMetaFooter({
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
}: AuditMetaFooterProps) {
  const { t } = useTranslation()
  const created = formatWhen(createdAt)
  const updated = formatWhen(updatedAt)
  if (!created && !updated && !createdBy && !updatedBy) return null
  return (
    <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
      {created || createdBy ? (
        <span>
          {t('common.createdMeta', {
            by: createdBy ?? '—',
            at: created ?? '—',
          })}
        </span>
      ) : null}
      {updated || updatedBy ? (
        <span>
          {t('common.updatedMeta', {
            by: updatedBy ?? '—',
            at: updated ?? '—',
          })}
        </span>
      ) : null}
    </div>
  )
}
