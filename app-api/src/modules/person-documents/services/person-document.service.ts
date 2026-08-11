import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AddPersonDocument,
  PersonDocumentDto,
} from '../../../contracts/person-document.contract';
import { AuditService } from '../../platform/services/audit.service';
import { PlatformRepository } from '../../platform/repositories/platform.repository';
import { PersonDocumentRepository } from '../person-document.repository';

/**
 * Centralized employee document store service. Adds versioned document metadata
 * (superseding prior versions of the same type), lists, and confirms. When a
 * licence/Emirates ID document carries an expiry, the matching person credential
 * expiry is kept in sync (self entry stays Unverified; steward confirm verifies).
 */
@Injectable()
export class PersonDocumentService {
  constructor(
    private readonly repo: PersonDocumentRepository,
    private readonly platform: PlatformRepository,
    private readonly audit: AuditService,
  ) {}

  /** Lists the documents held for a person. */
  list(personId: string): Promise<PersonDocumentDto[]> {
    return this.repo.list(personId);
  }

  /**
   * Adds a document. `verified` reflects trust: self-upload is Unverified,
   * admin/steward upload is Verified (mirrors credential provenance).
   */
  async add(
    personId: string,
    input: AddPersonDocument,
    actorPersonId: string,
    verified: boolean,
  ): Promise<PersonDocumentDto[]> {
    const person = await this.platform.findPerson(personId);
    if (!person) {
      throw new NotFoundException({
        title: 'Unknown person',
        reasons: [`person-not-found:${personId}`],
      });
    }
    const added = await this.repo.add(
      personId,
      actorPersonId,
      input,
      person.organizationId,
    );
    // Keep the person credential expiry in sync for licence / Emirates ID.
    if (input.expiryDate && input.docTypeCode === 'DRIVING_LICENCE') {
      await this.platform.updatePersonCredentials(personId, {
        licenceExpiry: input.expiryDate,
        licenceSource: 'manual',
        licenceVerified: verified,
        licenceUpdatedByPersonId: actorPersonId,
      });
    }
    if (input.expiryDate && input.docTypeCode === 'EMIRATES_ID') {
      await this.platform.updatePersonCredentials(personId, {
        emiratesIdExpiry: input.expiryDate,
        emiratesIdSource: 'manual',
        emiratesIdVerified: verified,
        emiratesIdUpdatedByPersonId: actorPersonId,
      });
    }
    await this.audit.record({
      organizationId: person.organizationId,
      actorRef: actorPersonId,
      action: 'PERSON_DOCUMENT_ADDED',
      entityRef: `person:${personId}`,
      after: {
        documentId: added.id,
        type: input.docTypeCode,
        version: added.version,
        verified,
        self: actorPersonId === personId,
      },
    });
    return this.repo.list(personId);
  }

  /** Confirms (verifies) a document by a steward/admin. */
  async confirm(documentId: string, actorPersonId: string): Promise<void> {
    const doc = await this.repo.findById(documentId);
    if (!doc) {
      throw new NotFoundException({
        title: 'Unknown document',
        reasons: [`person-document-not-found:${documentId}`],
      });
    }
    await this.repo.confirm(documentId);
    await this.audit.record({
      organizationId: doc.organizationId,
      actorRef: actorPersonId,
      action: 'PERSON_DOCUMENT_CONFIRMED',
      entityRef: `person:${doc.personId}`,
      after: { documentId, type: doc.docTypeCode },
    });
  }
}
