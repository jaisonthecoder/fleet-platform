import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../../common/tenancy/tenant.repository';

@Injectable()
export class FeaturesRepository extends TenantRepository {}
