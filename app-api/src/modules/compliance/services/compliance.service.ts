import { Injectable, NotFoundException } from '@nestjs/common';
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

  async listExpiries(organizationId: string): Promise<ComplianceItemDto[]> {
    const items = await this.repo.listExpiries(organizationId);
    return items.map((i) => ({
      id: i.id,
      subjectType: i.subjectType,
      subjectRef: i.subjectRef,
      itemType: i.itemType,
      status: i.status,
      expiryDate: i.expiryDate,
    }));
  }

  async listBlocks(organizationId: string): Promise<AccessBlockDto[]> {
    const blocks = await this.repo.listActiveBlocks(organizationId);
    return blocks.map((b) => ({ id: b.id, personId: b.personId, reason: b.reason, active: b.active }));
  }

  async raiseBlock(input: RaiseBlock, actorRef = 'system', organizationId: string): Promise<AccessBlockDto> {
    if (!(await this.repo.findPersonInOrganization(input.personId, organizationId))) {
      throw new NotFoundException({ title: 'Unknown person', reasons: [`person-not-found:${input.personId}`] });
    }
    let block;
    try {
      block = await this.repo.insertBlock({ organizationId, personId: input.personId, reason: input.reason });
    } catch (error) {
      throw toDbException(error);
    }
    await this.audit.record({
      organizationId,
      actorRef,
      action: 'ACCESS_BLOCK_RAISED',
      entityRef: `person:${input.personId}`,
      after: { reason: input.reason },
    });
    return { id: block.id, personId: block.personId, reason: block.reason, active: block.active };
  }

  async liftBlock(id: string, actorRef = 'system', organizationId: string): Promise<{ ok: true }> {
    if (!(await this.repo.liftBlock(id, organizationId))) {
      throw new NotFoundException({ title: 'Unknown access block', reasons: [`access-block-not-found:${id}`] });
    }
    await this.audit.record({ organizationId, actorRef, action: 'ACCESS_BLOCK_LIFTED', entityRef: `access-block:${id}` });
    return { ok: true };
  }
}
