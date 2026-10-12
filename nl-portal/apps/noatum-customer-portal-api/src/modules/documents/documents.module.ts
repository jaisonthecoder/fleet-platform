import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FileStorageAdapter } from '../../contracts/adapters/file-storage.adapter';
import { AzureBlobStorageAdapter } from '../../integration/storage/azure-blob-storage.adapter';
import { LocalDiskStorageAdapter } from '../../integration/storage/local-disk-storage.adapter';

import { AttachmentsService } from './attachments.service';
import { DocumentsController } from './documents.controller';
import { FileValidationService } from './file-validation.service';

/**
 * Attachments on a quote, in both directions.
 *
 * The storage binding is chosen by configuration rather than by environment name,
 * so a developer can point at a real container without pretending to be
 * production. `STORAGE_DRIVER=local` is refused in production by environment
 * validation, which is where that rule belongs rather than here.
 */
@Module({
  controllers: [DocumentsController],
  providers: [
    AttachmentsService,
    FileValidationService,
    {
      provide: FileStorageAdapter,
      useFactory: (config: ConfigService) =>
        config.get<string>('storage.driver') === 'azure-blob'
          ? new AzureBlobStorageAdapter(config)
          : new LocalDiskStorageAdapter(config),
      inject: [ConfigService],
    },
  ],
  exports: [AttachmentsService],
})
export class DocumentsModule {}
