import { Injectable } from '@nestjs/common';

import { TenantRepository } from '../../common/tenancy/tenant.repository';

/**
 * Regions and branches are internal-only reference data. Every read and write
 * runs through `runInternal`, so a customer context can never reach them.
 */
@Injectable()
export class OperatingRepository extends TenantRepository {}
