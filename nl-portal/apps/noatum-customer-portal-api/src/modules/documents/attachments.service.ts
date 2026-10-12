import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AnalyticsService } from '../../common/analytics/analytics.service';
import { FeatureSwitchService } from '../../common/features/feature-switch.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { TenantRepository, type TenantClient } from '../../common/tenancy/tenant.repository';
import { FileStorageAdapter } from '../../contracts/adapters/file-storage.adapter';
import {
  internalQuoteDocumentFor,
  quoteDocumentFor,
  type InternalQuoteDocumentDto,
  type QuoteDocumentDto,
} from '../../contracts/dto/quote-document.dto';
import { PERMISSIONS } from '../../contracts/permissions';
import {
  isTypeAllowedForDirection,
  uploadQuoteDocumentSchema,
} from '../../contracts/schemas/quote-document.schema';

import { checksumOf } from '../../integration/storage/local-disk-storage.adapter';
import { FileValidationService, type UploadCandidate } from './file-validation.service';

/** Everything a download needs, resolved in one place. */
export interface DownloadableDocument {
  filename: string;
  contentType: string;
  content: Buffer;
}

const FILE_SELECT = {
  originalFilename: true,
  contentType: true,
  sizeBytes: true,
  uploadedAt: true,
  uploadedBy: { select: { displayName: true } },
} as const;

/**
 * Attachments on a quote, in both directions.
 *
 * Three rules shape every method here:
 *
 *  - a document the customer may not see is **absent** from their surfaces, not
 *    filtered out of a payload that still contains it;
 *  - an unknown document and somebody else's document give the identical answer,
 *    so a 404 never confirms that a file exists;
 *  - the row and the object are written together, and the object is written
 *    first - an orphaned blob is litter, but an orphaned row is a broken link on
 *    a customer's screen.
 */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
    private readonly storage: FileStorageAdapter,
    private readonly validation: FileValidationService,
    private readonly switches: FeatureSwitchService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService,
  ) {}

  async upload(
    quoteId: string,
    body: unknown,
    file: UploadCandidate,
  ): Promise<InternalQuoteDocumentDto> {
    const actor = this.context.require();
    const parsed = uploadQuoteDocumentSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const { documentType, direction } = parsed.data;

    // A customer cannot attach a "quotation", and a branch does not answer with a
    // safety data sheet. The enum alone would let either happen.
    if (!isTypeAllowedForDirection(documentType, direction)) {
      throw new BadRequestException({
        message: 'That document type does not belong in this direction.',
        details: { code: 'DOCUMENT_TYPE_WRONG_DIRECTION', documentType, direction },
      });
    }

    // Who may send which way is not negotiable: a customer session cannot create
    // a document the portal will present as Noatum's answer.
    if (direction === 'to_customer' && !actor.isInternal) {
      throw new ForbiddenException({
        message: 'Only Noatum staff can attach an answer to a quote.',
        details: { code: 'DOCUMENT_DIRECTION_NOT_PERMITTED' },
      });
    }

    if (direction === 'from_customer' && actor.isInternal) {
      throw new ForbiddenException({
        message: 'A supporting document is attached by the customer, not on their behalf.',
        details: { code: 'DOCUMENT_DIRECTION_NOT_PERMITTED' },
      });
    }

    await this.assertSwitchAllows(direction);

    if (!this.storage.isConfigured()) {
      // Refused rather than queued. Telling a customer their safety data sheet is
      // attached when nothing stored it is worse than telling them to try again.
      throw new ForbiddenException({
        message: 'Attachments are unavailable at the moment.',
        details: { code: 'STORAGE_UNAVAILABLE' },
      });
    }

    const maxBytes = this.config.get<number>('storage.maxUploadBytes') ?? 20 * 1024 * 1024;
    const validated = this.validation.validate(file, maxBytes);
    const container = this.config.get<string>('storage.container') ?? 'noatum-quote-documents';

    const quote = await this.repo.run((tx) =>
      tx.quote.findUnique({
        where: { id: quoteId },
        select: { id: true, customerGroupId: true, status: true },
      }),
    );

    // RLS already hid another tenant's quote, so "not found" covers both.
    if (!quote) {
      throw new NotFoundException({
        message: 'Quote not found.',
        details: { code: 'QUOTE_NOT_FOUND' },
      });
    }

    const blobName = this.validation.blobNameFor(quote.customerGroupId, quote.id, validated.extension);

    // Object first, row second. If the row write fails the object is litter we
    // can sweep; if the object write failed after the row, the customer would see
    // a document that cannot be downloaded.
    await this.storage.put({
      container,
      blobName,
      content: file.buffer,
      contentType: validated.contentType,
    });

    try {
      const created = await this.repo.run(async (tx) => {
        const position = await this.nextPosition(tx, quoteId);

        // Through the function, not `create()`. Prisma's create emits
        // `INSERT ... RETURNING`, and PostgreSQL applies the SELECT policy to the
        // RETURNING clause - which cannot pass here, because the linking row that
        // would make this file readable does not exist yet.
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT app.record_stored_file(
            ${container},
            ${blobName},
            ${validated.originalFilename},
            ${validated.contentType},
            ${validated.sizeBytes},
            ${checksumOf(file.buffer)},
            ${actor.userId}::uuid
          ) AS id`;

        const storedFileId = rows[0]?.id;

        if (!storedFileId) {
          throw new Error('Storing the file returned no id.');
        }

        const document = await tx.quoteDocument.create({
          data: {
            quoteId,
            storedFileId,
            documentType,
            direction,
            // A customer's own upload is always visible to them; hiding it would
            // be absurd. Only the answer direction can be held back.
            customerVisible: direction === 'from_customer' ? true : (parsed.data.customerVisible ?? true),
            position,
          },
          select: {
            id: true,
            documentType: true,
            direction: true,
            customerVisible: true,
            file: { select: FILE_SELECT },
          },
        });

        await tx.auditEvent.create({
          data: {
            customerGroupId: quote.customerGroupId,
            actorUserId: actor.userId,
            action: 'quote.document.uploaded',
            entityType: 'quote',
            entityId: quoteId,
            metadata: {
              documentId: document.id,
              documentType,
              direction,
              sizeBytes: validated.sizeBytes,
            },
          },
        });

        await this.analytics.recordIn(tx, {
          action: 'quote.document.uploaded',
          entityType: 'quote',
          entityId: quoteId,
          customerGroupId: quote.customerGroupId,
          metadata: { direction },
        });

        return document;
      });

      return internalQuoteDocumentFor(created);
    } catch (error) {
      // The row never landed, so nothing points at this object. Leaving it would
      // be a file nobody can reach and nobody can account for.
      await this.storage.delete({ container, blobName }).catch(() => {
        this.logger.error(`Orphaned object after a failed upload: ${container}/${blobName}`);
      });
      throw error;
    }
  }

  /** What the customer may see: their own papers, and answers marked visible. */
  async listForCustomer(quoteId: string): Promise<QuoteDocumentDto[]> {
    const rows = await this.repo.run((tx) =>
      tx.quoteDocument.findMany({
        // Omitted at the query. A row that reaches the service and is filtered in
        // a map has already been one refactor away from shipping.
        where: { quoteId, customerVisible: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          documentType: true,
          direction: true,
          customerVisible: true,
          file: { select: FILE_SELECT },
        },
      }),
    );

    return rows.map(quoteDocumentFor);
  }

  /** What staff see: everything, including what is held back. */
  async listForStaff(quoteId: string): Promise<InternalQuoteDocumentDto[]> {
    const rows = await this.repo.runInternal((tx) =>
      tx.quoteDocument.findMany({
        where: { quoteId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          documentType: true,
          direction: true,
          customerVisible: true,
          file: { select: FILE_SELECT },
        },
      }),
    );

    return rows.map(internalQuoteDocumentFor);
  }

  /**
   * The bytes, streamed through the API so the check and the content travel
   * together.
   *
   * Every refusal is the same `NotFoundException`. An out-of-scope document, an
   * invisible one and one that never existed are indistinguishable, because any
   * difference would confirm that somebody else's file is there.
   */
  async download(documentId: string): Promise<DownloadableDocument> {
    const actor = this.context.require();

    const document = await this.repo.run((tx) =>
      tx.quoteDocument.findUnique({
        where: { id: documentId },
        select: {
          customerVisible: true,
          quote: { select: { customerGroupId: true } },
          file: {
            select: { blobContainer: true, blobName: true, originalFilename: true, contentType: true },
          },
        },
      }),
    );

    if (!document) throw this.gone();

    if (!actor.isInternal && !document.customerVisible) throw this.gone();

    const content = await this.storage.get({
      container: document.file.blobContainer,
      blobName: document.file.blobName,
    });

    if (content === null) {
      // The row survived its object. Worth an error log - it means a container
      // was cleaned behind us - but the caller gets the same answer as always.
      this.logger.error(
        `Document ${documentId} has no object at ${document.file.blobContainer}/${document.file.blobName}.`,
      );
      throw this.gone();
    }

    await this.repo.run((tx) =>
      tx.auditEvent.create({
        data: {
          customerGroupId: document.quote.customerGroupId,
          actorUserId: actor.userId,
          action: 'quote.document.downloaded',
          entityType: 'quote_document',
          entityId: documentId,
          metadata: { internal: actor.isInternal },
        },
      }),
    );

    return {
      filename: document.file.originalFilename,
      contentType: document.file.contentType,
      content,
    };
  }

  /**
   * Staff only. Removes the link and the object; the audit row remains.
   *
   * Internal by design, and the database agrees: `stored_file` only accepts a
   * delete from an internal session. A customer who attached the wrong file asks
   * us to remove it, which keeps a deliberate act behind a person who can see
   * what else is on the quote.
   */
  async remove(documentId: string): Promise<void> {
    const actor = this.context.require();

    if (!actor.isInternal || !actor.permissions.has(PERMISSIONS.DOCUMENTS_UPLOAD)) {
      throw new ForbiddenException({
        message: 'You cannot remove a document from this quote.',
        details: { code: 'DOCUMENT_REMOVE_NOT_PERMITTED' },
      });
    }

    const document = await this.repo.runInternal((tx) =>
      tx.quoteDocument.findUnique({
        where: { id: documentId },
        select: {
          storedFileId: true,
          quoteId: true,
          quote: { select: { customerGroupId: true } },
          file: { select: { blobContainer: true, blobName: true } },
        },
      }),
    );

    if (!document) throw this.gone();

    await this.repo.runInternal(async (tx) => {
      await tx.quoteDocument.delete({ where: { id: documentId } });
      await tx.storedFile.delete({ where: { id: document.storedFileId } });

      await tx.auditEvent.create({
        data: {
          customerGroupId: document.quote.customerGroupId,
          actorUserId: actor.userId,
          action: 'quote.document.removed',
          entityType: 'quote',
          entityId: document.quoteId,
          metadata: { documentId },
        },
      });
    });

    // After the commit. Deleting the object first would lose the file if the
    // transaction then rolled back.
    await this.storage.delete({
      container: document.file.blobContainer,
      blobName: document.file.blobName,
    });
  }

  private async assertSwitchAllows(direction: 'from_customer' | 'to_customer'): Promise<void> {
    const key = direction === 'from_customer'
      ? 'documents.customer_upload'
      : 'documents.quote_answer';

    if (!(await this.switches.isEnabled(key))) {
      throw new ForbiddenException({
        message: 'Attaching documents is turned off.',
        details: { code: 'FEATURE_DISABLED', switch: key },
      });
    }
  }

  /** Positions are per quote and start at one, so the list has a stable order. */
  private async nextPosition(tx: TenantClient, quoteId: string): Promise<number> {
    const last = await tx.quoteDocument.findFirst({
      where: { quoteId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return (last?.position ?? 0) + 1;
  }

  /** One answer for every refusal, so none of them is a signal. */
  private gone(): NotFoundException {
    return new NotFoundException({
      message: 'Document not found.',
      details: { code: 'DOCUMENT_NOT_FOUND' },
    });
  }
}
