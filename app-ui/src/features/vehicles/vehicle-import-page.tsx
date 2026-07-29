import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatusChip } from '@/components/ui/status-chip'
import { Textarea } from '@/components/ui/textarea'
import { defaultLanguage } from '@/i18n/config'
import { ApiRequestError } from '@/lib/api-client'
import { notify } from '@/hooks/use-toast'
import {
  IMPORT_COMPLETENESS_THRESHOLD,
  createImport,
  fetchImportBatch,
  fetchImportRows,
  parseImportRows,
  signOffImport,
} from './vehicle-import.contract'

function rowTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Valid' || status === 'Committed') return 'ok'
  if (status === 'Duplicate') return 'warn'
  if (status === 'Invalid' || status === 'Rejected') return 'danger'
  return 'neutral'
}

/** Bulk vehicle import (M3): stage → validate → review → steward sign-off. */
export function VehicleImportPage() {
  const { t } = useTranslation()
  const { lang = defaultLanguage } = useParams()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [batchId, setBatchId] = useState<string | null>(null)

  const preview = useMemo(() => parseImportRows(text), [text])

  const batch = useQuery({
    queryKey: ['import-batch', batchId],
    queryFn: () => fetchImportBatch(batchId as string),
    enabled: Boolean(batchId),
  })
  const rows = useQuery({
    queryKey: ['import-rows', batchId],
    queryFn: () => fetchImportRows(batchId as string),
    enabled: Boolean(batchId),
  })

  const stage = useMutation({
    mutationFn: () => createImport('manual-paste', preview.rows),
  })
  const signoff = useMutation({
    mutationFn: () => signOffImport(batchId as string),
  })

  const report = (error: unknown, fallback: string) => {
    const requestError = error instanceof ApiRequestError ? error : null
    notify.danger(fallback, { description: requestError?.reasons?.join(' · ') })
  }

  const onStage = async () => {
    try {
      const created = await stage.mutateAsync()
      setBatchId(created.id)
      notify.ok(t('vehicleImport.staged'))
    } catch (error) {
      report(error, t('vehicleImport.stageFailed'))
    }
  }

  const onSignOff = async () => {
    try {
      await signoff.mutateAsync()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['import-batch', batchId] }),
        queryClient.invalidateQueries({ queryKey: ['import-rows', batchId] }),
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-summary'] }),
      ])
      notify.ok(t('vehicleImport.signedOff'))
    } catch (error) {
      report(error, t('vehicleImport.signOffFailed'))
    }
  }

  const b = batch.data
  const canSignOff =
    b !== undefined &&
    b.completenessScore >= IMPORT_COMPLETENESS_THRESHOLD &&
    !b.signedOffByRef

  const tiles: Array<[string, number | string]> = b
    ? [
        [t('vehicleImport.tiles.total'), b.totalRows],
        [t('vehicleImport.tiles.valid'), b.validRows],
        [t('vehicleImport.tiles.invalid'), b.invalidRows],
        [t('vehicleImport.tiles.duplicate'), b.duplicateRows],
        [
          t('vehicleImport.tiles.completeness'),
          `${Math.round(b.completenessScore)}%`,
        ],
      ]
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('vehicleImport.eyebrow')}
        title={t('vehicleImport.title')}
        action={
          <Button asChild variant="railGhost">
            <Link to={`/${lang}/vehicles`}>
              <ArrowLeft aria-hidden="true" />
              {t('vehicleImport.back')}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">{t('vehicleImport.stageTitle')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('vehicleImport.stageHint')}
            </p>
          </div>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            className="font-data text-xs"
            aria-label={t('vehicleImport.pasteLabel')}
            placeholder='[ { "plate": "AD 12345", "chassisVin": "VIN-1", "bodyTypeCode": "SEDAN" } ]'
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {preview.error && preview.error !== 'empty'
                ? t('vehicleImport.parseError')
                : t('vehicleImport.rowsReady', { count: preview.rows.length })}
            </p>
            <Button
              onClick={() => void onStage()}
              disabled={preview.rows.length === 0 || stage.isPending}
            >
              <UploadCloud aria-hidden="true" />
              {stage.isPending
                ? t('vehicleImport.staging')
                : t('vehicleImport.stage')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {batchId ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t('vehicleImport.reviewTitle')}</h2>
                <p className="text-sm text-muted-foreground">
                  {b ? t(`vehicleImport.status.${b.status}`, { defaultValue: b.status }) : '—'}
                </p>
              </div>
              <Button
                variant="signal"
                onClick={() => void onSignOff()}
                disabled={!canSignOff || signoff.isPending}
              >
                {signoff.isPending
                  ? t('vehicleImport.signingOff')
                  : t('vehicleImport.signOff')}
              </Button>
            </div>

            {b && !canSignOff && !b.signedOffByRef ? (
              <p className="rounded-[3px] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                {t('vehicleImport.thresholdHint', {
                  threshold: IMPORT_COMPLETENESS_THRESHOLD,
                })}
              </p>
            ) : null}

            <section
              aria-label={t('vehicleImport.summary')}
              className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5"
            >
              {tiles.map(([label, value]) => (
                <div key={label} className="rounded-[3px] border border-border p-3">
                  <p className="text-xs uppercase text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </section>

            <div>
              <p className="eyebrow mb-2">{t('vehicleImport.rowsTitle')}</p>
              {rows.isPending ? (
                <p className="text-sm text-muted-foreground">
                  {t('vehicleImport.loadingRows')}
                </p>
              ) : (rows.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('vehicleImport.noRows')}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {rows.data?.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-[3px] border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-data text-muted-foreground">
                        #{row.rowNumber}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {row.reason ?? ''}
                      </span>
                      <StatusChip
                        tone={rowTone(row.status)}
                        label={t(`vehicleImport.status.${row.status}`, {
                          defaultValue: row.status,
                        })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
