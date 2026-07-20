import { z } from 'zod';

/** A raw source row (a vehicle-like record from the uploaded file). */
export const importRowInputSchema = z.record(z.string(), z.unknown());

/** Max rows per synchronous import batch (larger files route via a worker at scale). */
export const IMPORT_MAX_ROWS = 5000;

/** Stage a bulk import (rows already parsed from CSV/XLSX by the client/worker). */
export const createImportSchema = z.object({
  source: z.string().min(1),
  rows: z.array(importRowInputSchema).min(1).max(IMPORT_MAX_ROWS),
});
export type CreateImport = z.infer<typeof createImportSchema>;

/** Steward resolution of a flagged row. */
export const resolveRowSchema = z.object({
  rowId: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
});
export type ResolveRow = z.infer<typeof resolveRowSchema>;

/** Import batch summary projection. */
export interface ImportBatchDto {
  id: string;
  source: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  completenessScore: number;
  signedOffByRef: string | null;
}

/** One staged row's status projection. */
export interface ImportRowDto {
  id: string;
  rowNumber: number;
  status: string;
  reason: string | null;
  committedVehicleId: string | null;
}

/** The completeness threshold (%) required to sign off a batch (mitigates R5). */
export const IMPORT_COMPLETENESS_THRESHOLD = 98;
