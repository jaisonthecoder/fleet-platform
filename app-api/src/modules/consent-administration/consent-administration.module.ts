import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { ConsentAdministrationController } from './controllers/consent-administration.controller';
import { ConsentTemplateRepository } from './repositories/consent-template.repository';
import { ConsentAdministrationService } from './services/consent-administration.service';

@Module({
  imports: [PlatformModule],
  controllers: [ConsentAdministrationController],
  providers: [ConsentTemplateRepository, ConsentAdministrationService],
  exports: [ConsentAdministrationService],
})
export class ConsentAdministrationModule {}
