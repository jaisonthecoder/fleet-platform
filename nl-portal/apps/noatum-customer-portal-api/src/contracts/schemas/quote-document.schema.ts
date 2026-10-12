import { z } from 'zod';

/**
 * Document types a quote attachment may carry.
 *
 * An allow-list, per v4 rule 6: typing in CargoWise is manual and unvalidated, so
 * only explicitly approved types are ever visible to a customer. Free text here
 * would put an unreviewed label on a customer-facing surface.
 *
 * These are portal codes. Mapping them to whatever CargoWise calls the same thing
 * is the integration layer's job, through `mapping_entry`.
 */
export const QUOTE_DOCUMENT_TYPES = [
  // From the customer, supporting the request.
  'packing_list',
  'safety_data_sheet',
  'dangerous_goods_declaration',
  'commercial_invoice',
  'cargo_photo',
  'other_supporting',
  // From Noatum, answering it.
  'quotation',
  'terms_and_conditions',
] as const;

export type QuoteDocumentType = (typeof QUOTE_DOCUMENT_TYPES)[number];

export const QUOTE_DOCUMENT_DIRECTIONS = ['from_customer', 'to_customer'] as const;
export type QuoteDocumentDirection = (typeof QUOTE_DOCUMENT_DIRECTIONS)[number];

/**
 * Which types belong to which direction.
 *
 * A customer cannot attach something labelled `quotation`, and a branch does not
 * answer with a safety data sheet. Without this the type list is a free-for-all
 * that happens to be enumerated.
 */
export const DOCUMENT_TYPES_BY_DIRECTION = {
  from_customer: [
    'packing_list',
    'safety_data_sheet',
    'dangerous_goods_declaration',
    'commercial_invoice',
    'cargo_photo',
    'other_supporting',
  ],
  to_customer: ['quotation', 'terms_and_conditions', 'other_supporting'],
} as const satisfies Record<QuoteDocumentDirection, readonly QuoteDocumentType[]>;

export function isTypeAllowedForDirection(
  type: QuoteDocumentType,
  direction: QuoteDocumentDirection,
): boolean {
  return (DOCUMENT_TYPES_BY_DIRECTION[direction] as readonly string[]).includes(type);
}

/**
 * The upload body.
 *
 * The file itself arrives as multipart, not in here. This is the metadata beside
 * it, and it is validated exactly like any other request body.
 */
export const uploadQuoteDocumentSchema = z.object({
  documentType: z.enum(QUOTE_DOCUMENT_TYPES),
  direction: z.enum(QUOTE_DOCUMENT_DIRECTIONS),
  /**
   * Only meaningful on `to_customer`. A customer's own attachment is always
   * visible to them - hiding someone's own upload from them would be absurd.
   */
  customerVisible: z.boolean().optional(),
});

export type UploadQuoteDocumentInput = z.infer<typeof uploadQuoteDocumentSchema>;
