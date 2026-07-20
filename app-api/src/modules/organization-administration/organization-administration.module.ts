import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { OrganizationAdministrationController } from './controllers/organization-administration.controller';
import { OrganizationRepository } from './repositories/organization.repository';
import { OrganizationAdministrationService } from './services/organization-administration.service';

@Module({
  imports: [PlatformModule],
  controllers: [OrganizationAdministrationController],
  providers: [OrganizationRepository, OrganizationAdministrationService],
  exports: [OrganizationAdministrationService],
})
export class OrganizationAdministrationModule {}
