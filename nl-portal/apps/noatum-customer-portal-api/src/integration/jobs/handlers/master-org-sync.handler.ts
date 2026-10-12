import { Injectable, Logger } from '@nestjs/common';

import { OrganisationImportService } from '../../organisations/organisation-import.service';
import { JobHandler, JOB_NAMES, type JobName } from '../job.registry';

/**
 * Refreshes master_org from CW1.
 *
 * Platform job: master_org is reference data with no tenant column, so this runs under
 * runAsSystem. It must never read customer tables.
 */
@Injectable()
export class MasterOrgSyncHandler extends JobHandler<{ authoritative?: boolean; startedByUserId?: string | null }> {
  readonly name: JobName = JOB_NAMES.MASTER_ORG_SYNC;
  readonly tenantScoped = false;

  private readonly logger = new Logger(MasterOrgSyncHandler.name);

  constructor(private readonly imports: OrganisationImportService) {
    super();
  }

  async handle(payload: { authoritative?: boolean; startedByUserId?: string | null } = {}): Promise<void> {
    const result = await this.imports.run({
      authoritative: payload.authoritative,
      startedByUserId: payload.startedByUserId ?? null,
    });

    this.logger.log(
      `Organisation import ${result.runId} ${result.outcome}: ${result.created} new, ${result.updated} changed, ` +
      `${result.deactivated} deactivated, ${result.rejected} rejected`,
    );
  }
}
