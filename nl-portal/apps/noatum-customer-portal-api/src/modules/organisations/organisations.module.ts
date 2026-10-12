import { Module } from '@nestjs/common';

import { IntegrationModule } from '../../integration/integration.module';
import { CustomersRepository } from '../customers/customers.repository';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';

/**
 * The CargoWise organisation directory: browsing the mirror, and running the
 * import that fills it.
 *
 * The mirror itself is still written only by app.apply_organisation_batch — this
 * module triggers the importer, it does not write rows. Linking an organisation
 * to a customer belongs to the customers module because the customer is what it
 * changes.
 */
@Module({
  imports: [IntegrationModule],
  controllers: [OrganisationsController],
  providers: [CustomersRepository, OrganisationsService],
})
export class OrganisationsModule {}
