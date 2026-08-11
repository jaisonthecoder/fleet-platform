import { z } from 'zod';

/** Governed employee document types (reference-data-aligned, code-keyed). */
export const personDocumentTypeSchema = z.enum([
  'DRIVING_LICENCE',
  'EMIRATES_ID',
  'MEDICAL',
  'TRAINING',
  'OTHER',
]);
export type PersonDocumentType = z.infer<typeof personDocumentTypeSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be ISO (YYYY-MM-DD)');

/**
 * Adds a document metadata record. The binary (when present) is referenced by
 * `blobRef` (a private object-store key); consistent with vehicle/vendor docs.
 */
export const addPersonDocumentSchema = z
  .object({
    docTypeCode: personDocumentTypeSchema,
    documentReference: z.string().trim().min(1).max(200).optional(),
    blobRef: z
      .string()
      .max(512)
      .regex(/^person-documents\/[A-Za-z0-9][A-Za-z0-9._/-]*$/)
      .refine((v) => !v.includes('..'), 'blobRef must not traverse')
      .optional(),
    issueDate: isoDate.optional(),
    expiryDate: isoDate.optional(),
  })
  .strict();
export type AddPersonDocument = z.infer<typeof addPersonDocumentSchema>;

/** One document metadata record returned to the UI. */
export interface PersonDocumentDto {
  id: string;
  docTypeCode: string;
  documentReference: string | null;
  blobRef: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  version: number;
  status: string;
  createdAtUtc: string;
}
