import { Injectable, NotFoundException } from '@nestjs/common';
import { OutboxService } from '../../../common/messaging/outbox.service';
import type { VehicleTransferInput } from '../../../contracts/vehicle.contract';
import { AuditService } from '../../platform/services/audit.service';
import { toDbException } from '../internal/pg-error';
import { VehicleRepository } from '../repositories/vehicle.repository';

/**
 * Inter-node vehicle transfer. Effective-dates the current hierarchy assignment
 * closed and opens a new one for the destination node — the `btree_gist`
 * exclusion constraint guarantees no overlapping active assignments. State +
 * transfer record + audit + event commit in one transaction.
 */
@Injectable()
export class TransferService {
  constructor(
    private readonly repo: VehicleRepository,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Transfers a vehicle to a new hierarchy node. */
  async transfer(vehicleId: string, input: VehicleTransferInput, actorRef = 'system') {
    const vehicle = await this.repo.findById(vehicleId);
    if (!vehicle) {
      throw new NotFoundException({ title: 'Unknown vehicle', reasons: [`vehicle-not-found:${vehicleId}`] });
    }
    const active = await this.repo.activeAssignment(vehicleId);
    const fromNodeId = active?.nodeId ?? null;
    // One shared instant so the closed range and the new range are strictly
    // adjacent (no overlap → the exclusion constraint never false-fires).
    const now = new Date();
    try {
      return await this.repo.transaction(async (tx) => {
        if (active) {
          await this.repo.expireAssignment(active.id, tx, now);
        }
        await this.repo.insertAssignment({ organizationId: vehicle.organizationId, vehicleId, nodeId: input.toNodeId, validFrom: now }, tx);
        const transfer = await this.repo.insertTransfer(
          { vehicleId, fromNodeId, toNodeId: input.toNodeId, reason: input.reason ?? null },
          tx,
        );
        await this.audit.record(
          { actorRef, action: 'VEHICLE_TRANSFERRED', entityRef: `vehicle:${vehicleId}`, after: { fromNodeId, toNodeId: input.toNodeId } },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'vehicle', aggregateId: vehicleId, eventType: 'VehicleChanged', payload: { change: 'transfer', toNodeId: input.toNodeId } },
          tx,
        );
        return transfer;
      });
    } catch (error) {
      throw toDbException(error);
    }
  }
}
