import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  InternalQuoteDocumentDto,
  QuoteDocumentDto,
  UploadQuoteDocumentDto,
} from '../../contracts/dto/quote-document.dto';
import { PERMISSIONS } from '../../contracts/permissions';

import { AttachmentsService } from './attachments.service';
import type { UploadCandidate } from './file-validation.service';

/**
 * Documents on a quote.
 *
 * The bytes are streamed through this controller rather than handed out as a
 * signed URL, so the permission check, the tenancy check and the audit record all
 * happen on the request that serves the file.
 */
@ApiTags('documents')
@ApiBearerAuth()
@Controller('quotes/:quoteId/documents')
export class DocumentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /**
   * Held in memory, not spooled to disk: the size ceiling is enforced here as
   * well as in the service, so a large body is refused before it lands anywhere.
   */
  @RequirePermission(PERMISSIONS.DOCUMENTS_UPLOAD)
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadQuoteDocumentDto })
  @ApiOkResponse({ type: InternalQuoteDocumentDto })
  upload(
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @UploadedFile() file: UploadCandidate,
    // Multipart fields arrive as strings, so the body is parsed in the service
    // against the same zod schema every other route uses.
    @Body() body: unknown,
  ) {
    return this.attachments.upload(quoteId, normalise(body), file);
  }

  /** The customer's view. Documents held back are absent, not flagged. */
  @RequirePermission(PERMISSIONS.QUOTES_READ)
  @Get()
  @ApiOkResponse({ type: [QuoteDocumentDto] })
  list(@Param('quoteId', ParseUUIDPipe) quoteId: string) {
    return this.attachments.listForCustomer(quoteId);
  }

  @RequirePermission(PERMISSIONS.PRICING_QUEUE_READ)
  @Get('internal')
  @ApiOperation({ summary: 'Every document, including those the customer cannot see' })
  @ApiOkResponse({ type: [InternalQuoteDocumentDto] })
  listInternal(@Param('quoteId', ParseUUIDPipe) quoteId: string) {
    return this.attachments.listForStaff(quoteId);
  }

  @RequirePermission(PERMISSIONS.DOCUMENTS_DOWNLOAD)
  @Get(':documentId/download')
  @ApiOperation({ summary: 'The file itself' })
  async download(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const document = await this.attachments.download(documentId);

    response.setHeader('Content-Type', document.contentType);
    // `attachment` so a PDF or an image is saved rather than rendered in the
    // portal's own origin, where a crafted file would run beside a session.
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.filename}"; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(document.content);
  }

  @RequirePermission(PERMISSIONS.DOCUMENTS_UPLOAD)
  @Delete(':documentId')
  @ApiOperation({ summary: 'Removes a document and its stored object' })
  remove(@Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.attachments.remove(documentId);
  }
}

/**
 * Multipart sends every field as a string, so `customerVisible` arrives as
 * `"true"`. Converted here rather than loosening the schema, which the JSON
 * routes also use.
 */
function normalise(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return body;

  const raw = body as Record<string, unknown>;
  if (typeof raw.customerVisible !== 'string') return raw;

  return { ...raw, customerVisible: raw.customerVisible === 'true' };
}
