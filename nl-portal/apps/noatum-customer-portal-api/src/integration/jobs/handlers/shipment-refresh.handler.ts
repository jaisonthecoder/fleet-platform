import { Injectable, Logger } from '@nestjs/common';

import { JobHandler, JOB_NAMES, type JobName } from '../job.registry';

export interface ShipmentRefreshPayload {
  /** Required: this job is tenant-scoped and JobsService enforces its presence. */
  customerGroupId: string;
}

/**
 * Phase 2. Pulls shipment milestones for one tenant into the local read model.
 *
 * Tenant-scoped, so JobsService runs it with that group in context and RLS applies to
 * every write, exactly as it would in a request.
 */
@Injectable()
export class ShipmentRefreshHandler extends JobHandler<ShipmentRefreshPayload> {
  readonly name: JobName = JOB_NAMES.SHIPMENT_REFRESH;
  readonly tenantScoped = true;

  private readonly logger = new Logger(ShipmentRefreshHandler.name);

  async handle(payload: ShipmentRefreshPayload): Promise<void> {
    // TODO(S2.01): resolve org codes, query CW1, upsert milestones.
    this.logger.log(`shipment refresh placeholder for group ${payload.customerGroupId}.`);
  }
}
