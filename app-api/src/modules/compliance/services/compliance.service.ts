import { Injectable } from '@nestjs/common';
import { toDbException } from '../../../common/database/pg-error';
import type {
  AccessBlockDto,
  ComplianceItemDto,
  RaiseBlock,
} from '../../../contracts/compliance.contract';
import { AuditService } from '../../platform/services/audit.service';
import { ComplianceRepository } from '../repositories/compliance.repository';

/**
 * Compliance read + block administration. Expiry ladders (scheduled alerts via
 * `scheduled_work`) run on the platform scheduler; here we expose the current
 * expiry set and the active platform-wide access blocks, and let authorised
 * roles raise/lift a block (e.g. overdue black-point transfer).
 */
@Injectable()
export class ComplianceService {
  constructor(
    private readonly repo: ComplianceRepository,
    private readonly audit: AuditService,
  ) {}

  async listExpiries(): Promise<ComplianceItemDto[]> {
    const items = await this.repo.listExpiries();
    return items.map((i) => ({
      id: i.id,
      subjectType: i.subjectType,
      subjectRef: i.subjectRef,
      itemType: i.itemType,
      status: i.status,
      expiryDate: i.expiryDate,
    }));
  }

  async listBlocks(): Promise<AccessBlockDto[]> {
    const blocks = await this.repo.listActiveBlocks();
    return blocks.map((b) => ({ id: b.id, personId: b.personId, reason: b.reason, active: b.active }));
  }

  async raiseBlock(input: RaiseBlock, actorRef = 'system'): Promise<AccessBlockDto> {
    let block;
    try {
      block = await this.repo.insertBlock({ personId: input.personId, reason: input.reason });
    } catch (error) {
      throw toDbException(error);
    }
    await this.audit.record({
      actorRef,
      action: 'ACCESS_BLOCK_RAISED',
      entityRef: `person:${input.personId}`,
      after: { reason: input.reason },
    });
    return { id: block.id, personId: block.personId, reason: block.reason, active: block.active };
  }

  async liftBlock(id: string, actorRef = 'system'): Promise<{ ok: true }> {
    await this.repo.liftBlock(id);
    await this.audit.record({ actorRef, action: 'ACCESS_BLOCK_LIFTED', entityRef: `access-block:${id}` });
    return { ok: true };
  }
}
