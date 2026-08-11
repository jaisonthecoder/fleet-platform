import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../common/database/database.constants';
import type { DrizzleDatabase } from '../../common/database/database.module';
import { personDocument } from '../../common/database/schema';
import type {
  AddPersonDocument,
  PersonDocumentDto,
} from '../../contracts/person-document.contract';

/** Data access for the centralized employee document store. */
@Injectable()
export class PersonDocumentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Lists a person's documents, newest first. */
  async list(personId: string): Promise<PersonDocumentDto[]> {
    const rows = await this.db
      .select({
        id: personDocument.id,
        docTypeCode: personDocument.docTypeCode,
        documentReference: personDocument.documentReference,
        blobRef: personDocument.blobRef,
        issueDate: personDocument.issueDate,
        expiryDate: personDocument.expiryDate,
        version: personDocument.version,
        status: personDocument.status,
        createdAtUtc: personDocument.createdAtUtc,
      })
      .from(personDocument)
      .where(eq(personDocument.personId, personId))
      .orderBy(desc(personDocument.createdAtUtc));
    return rows.map((r) => ({
      ...r,
      createdAtUtc: r.createdAtUtc.toISOString(),
    }));
  }

  /** Finds a single document by id (for confirm/scope checks). */
  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(personDocument)
      .where(eq(personDocument.id, id))
      .limit(1);
    return rows[0];
  }

  /**
   * Adds a new version of a document type, superseding any prior live rows of
   * the same type in one transaction. Returns the new record id + version.
   */
  async add(
    personId: string,
    actorPersonId: string,
    input: AddPersonDocument,
    organizationId: string,
  ): Promise<{ id: string; version: number }> {
    return this.db.transaction(async (tx) => {
      const prior = await tx
        .select({ version: personDocument.version })
        .from(personDocument)
        .where(
          and(
            eq(personDocument.personId, personId),
            eq(personDocument.docTypeCode, input.docTypeCode),
          ),
        )
        .orderBy(desc(personDocument.version))
        .limit(1);
      const nextVersion = (prior[0]?.version ?? 0) + 1;
      await tx
        .update(personDocument)
        .set({ status: 'Superseded', updatedAtUtc: new Date() })
        .where(
          and(
            eq(personDocument.personId, personId),
            eq(personDocument.docTypeCode, input.docTypeCode),
            ne(personDocument.status, 'Superseded'),
          ),
        );
      const inserted = await tx
        .insert(personDocument)
        .values({
          organizationId,
          personId,
          docTypeCode: input.docTypeCode,
          documentReference: input.documentReference ?? null,
          blobRef: input.blobRef ?? null,
          issueDate: input.issueDate ?? null,
          expiryDate: input.expiryDate ?? null,
          version: nextVersion,
          status: 'Uploaded',
          uploadedByPersonId: actorPersonId,
        })
        .returning({ id: personDocument.id, version: personDocument.version });
      return inserted[0];
    });
  }

  /** Marks a document Confirmed (steward verification). */
  async confirm(id: string): Promise<void> {
    await this.db
      .update(personDocument)
      .set({ status: 'Confirmed', updatedAtUtc: new Date() })
      .where(eq(personDocument.id, id));
  }
}
