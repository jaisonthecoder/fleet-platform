import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { PersonDocumentController } from './controllers/person-document.controller';
import { PersonDocumentRepository } from './person-document.repository';
import { PersonDocumentService } from './services/person-document.service';

/**
 * Centralized employee document store (M-credentials). Reuses PlatformModule for
 * the person repository (credential sync) and audit. Documents are surfaced by
 * the profile (self) and access-management (admin) surfaces.
 */
@Module({
  imports: [PlatformModule],
  controllers: [PersonDocumentController],
  providers: [PersonDocumentRepository, PersonDocumentService],
  exports: [PersonDocumentService],
})
export class PersonDocumentsModule {}
