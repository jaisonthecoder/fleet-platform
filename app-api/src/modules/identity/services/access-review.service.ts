import { Injectable } from '@nestjs/common';
import type { AccessReviewRow } from '../../../contracts/user-admin.contract';
import { IdentityRepository } from '../repositories/identity.repository';

/**
 * Access-review export (FR-IAM-05): the recertification "who has what, where"
 * view over all currently-active role assignments, with grant provenance.
 */
@Injectable()
export class AccessReviewService {
  constructor(private readonly repo: IdentityRepository) {}

  /** Returns every active (person, role, scope) grant with its provenance. */
  async export(): Promise<AccessReviewRow[]> {
    const rows = await this.repo.listActiveAssignments();
    return rows.map((r) => ({
      assignmentId: r.id,
      personId: r.personId,
      role: r.role,
      scopeNodeId: r.scopeNodeId,
      source: r.source,
      assignedByPersonId: r.assignedByPersonId,
    }));
  }
}
