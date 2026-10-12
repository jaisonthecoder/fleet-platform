import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  QUOTE_DOCUMENT_DIRECTIONS,
  QUOTE_DOCUMENT_TYPES,
  type QuoteDocumentDirection,
  type QuoteDocumentType,
} from '../schemas/quote-document.schema';

/**
 * A document on a quote, as any surface sees it.
 *
 * There is no `customerVisible` field and no blob name. The customer projection
 * omits invisible rows at the query, so a flag here would be a second chance to
 * get it wrong - and a blob name would hand a caller the one string the storage
 * layer refuses to take from them.
 */
export class QuoteDocumentDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: QUOTE_DOCUMENT_TYPES })
  documentType!: QuoteDocumentType;

  @ApiProperty({ enum: QUOTE_DOCUMENT_DIRECTIONS })
  direction!: QuoteDocumentDirection;

  @ApiProperty({ type: String, example: 'packing-list.pdf' })
  filename!: string;

  @ApiProperty({ type: String, example: 'application/pdf' })
  contentType!: string;

  @ApiProperty({ type: Number })
  sizeBytes!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  uploadedAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  uploadedByName!: string | null;
}

/** Staff see one more thing than the customer does. */
export class InternalQuoteDocumentDto extends QuoteDocumentDto {
  @ApiProperty({
    type: Boolean,
    description: 'False means the customer cannot see this document at all.',
  })
  customerVisible!: boolean;
}

export class UploadQuoteDocumentDto {
  @ApiProperty({ enum: QUOTE_DOCUMENT_TYPES })
  documentType!: QuoteDocumentType;

  @ApiProperty({ enum: QUOTE_DOCUMENT_DIRECTIONS })
  direction!: QuoteDocumentDirection;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Only meaningful on to_customer. Defaults to true.',
  })
  customerVisible?: boolean;

  @ApiProperty({ type: 'string', format: 'binary' })
  file!: unknown;
}

interface DocumentRow {
  id: string;
  documentType: string;
  direction: string;
  customerVisible: boolean;
  file: {
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    uploadedAt: Date;
    uploadedBy: { displayName: string } | null;
  };
}

export function quoteDocumentFor(row: DocumentRow): QuoteDocumentDto {
  return {
    id: row.id,
    documentType: row.documentType as QuoteDocumentType,
    direction: row.direction as QuoteDocumentDirection,
    filename: row.file.originalFilename,
    contentType: row.file.contentType,
    sizeBytes: row.file.sizeBytes,
    uploadedAt: row.file.uploadedAt.toISOString(),
    uploadedByName: row.file.uploadedBy?.displayName ?? null,
  };
}

export function internalQuoteDocumentFor(row: DocumentRow): InternalQuoteDocumentDto {
  return { ...quoteDocumentFor(row), customerVisible: row.customerVisible };
}
