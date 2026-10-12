import { Module } from '@nestjs/common';

import { IntegrationModule } from '../../integration/integration.module';
import { CustomersController } from './customers.controller';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';

/**
 * Customer onboarding: the tenant, its lifecycle, and the organisations attached
 * to it. Design: docs/design/13-Customer-Onboarding-Flow-Design.md.
 *
 * There is no approval step. What protects the boundary instead is the link gate
 * (only source-confirmed organisations), the global unique code index, and the
 * customer lifecycle - a customer that has not gone live grants nothing.
 */
@Module({
  imports: [IntegrationModule],
  controllers: [CustomersController],
  providers: [CustomersRepository, CustomersService],
})
export class CustomersModule {}
