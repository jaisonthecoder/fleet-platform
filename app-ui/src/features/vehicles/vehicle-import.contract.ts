import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

/** Completeness (%) a batch must reach before a steward can sign off (mirrors BE). */
export const IMPORT_COMPLETENESS_THRESHOLD = 98

export const importBatchSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  status: z.string(),
  totalRows: z.number(),
  validRows: z.number(),
  invalidRows: z.number(),
  duplicateRows: z.number(),
  completenessScore: z.number(),
  signedOffByRef: z.string().nullable(),
})
export type ImportBatch = z.infer<typeof importBatchSchema>

export const importRowSchema = z.object({
  id: z.string().uuid(),
  rowNumber: z.number(),
  status: z.string(),
  reason: z.string().nullable(),
  committedVehicleId: z.string().uuid().nullable(),
})
export type ImportRow = z.infer<typeof importRowSchema>

/** Stages a parsed row set for validation + reconciliation. */
export async function createImport(
  source: string,
  rows: Record<string, unknown>[],
): Promise<ImportBatch> {
  return importBatchSchema.parse(
    await apiClient.post('/v1/imports', { source, rows }),
  )
}

/** Batch summary (status + validation counts). */
export async function fetchImportBatch(id: string): Promise<ImportBatch> {
  return importBatchSchema.parse(await apiClient.get(`/v1/imports/${id}`))
}

/** Staged rows with their per-row validation status. */
export async function fetchImportRows(id: string): Promise<ImportRow[]> {
  return z
    .array(importRowSchema)
    .parse(await apiClient.get(`/v1/imports/${id}/rows`))
}

/** Steward sign-off — commits valid rows to the vehicle master. */
export async function signOffImport(id: string): Promise<void> {
  await apiClient.post(`/v1/imports/${id}/sign-off`)
}

/**
 * Parses pasted text as an import row set: a JSON array/object, or CSV with a
 * header row. Returns the rows plus an optional error message.
 */
export function parseImportRows(text: string): {
  rows: Record<string, unknown>[]
  error?: string
} {
  const trimmed = text.trim()
  if (!trimmed) return { rows: [], error: 'empty' }
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      const rows = Array.isArray(parsed) ? parsed : (parsed.rows ?? [parsed])
      if (!Array.isArray(rows)) return { rows: [], error: 'shape' }
      return { rows: rows as Record<string, unknown>[] }
    } catch {
      return { rows: [], error: 'json' }
    }
  }
  // CSV: first non-empty line is the header.
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return { rows: [], error: 'csv' }
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',')
    const row: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      row[header] = cells[index]?.trim() ?? ''
    })
    return row
  })
  return { rows }
}
