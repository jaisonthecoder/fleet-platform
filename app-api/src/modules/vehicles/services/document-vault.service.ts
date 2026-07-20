import { Injectable, NotFoundException } from '@nestjs/common';
import type { AddVehicleDocument } from '../../../contracts/vehicle.contract';
import { AuditService } from '../../platform/services/audit.service';
import { VehicleRepository } from '../repositories/vehicle.repository';

/**
 * The versioned, insert-only document vault (Mulkiya, insurance, …). Adding a
 * document creates the next version for its type — old versions are retained
 * (soft-state; history + compliance depend on them).
 */
@Injectable()
export class DocumentVaultService {
  constructor(
    private readonly repo: VehicleRepository,
    private readonly audit: AuditService,
  ) {}

  /** Adds the next version of a document for a vehicle. */
  async addDocument(vehicleId: string, input: AddVehicleDocument, actorRef = 'system') {
    const vehicle = await this.repo.findById(vehicleId);
    if (!vehicle) {
      throw new NotFoundException({ title: 'Unknown vehicle', reasons: [`vehicle-not-found:${vehicleId}`] });
    }
    const version = await this.repo.nextDocumentVersion(vehicleId, input.docTypeCode);
    const doc = await this.repo.insertDocument({
      vehicleId,
      docTypeCode: input.docTypeCode,
      issueDate: input.issueDate ?? null,
      expiryDate: input.expiryDate ?? null,
      blobRef: input.blobRef ?? null,
      version,
    });
    await this.audit.record({
      actorRef,
      action: 'VEHICLE_DOCUMENT_ADDED',
      entityRef: `vehicle:${vehicleId}`,
      after: { docType: input.docTypeCode, version },
    });
    return doc;
  }
}
