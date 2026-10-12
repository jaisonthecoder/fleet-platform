import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  FileStorageAdapter,
  type StoredFileHandle,
  type StoredFileInput,
} from '../../contracts/adapters/file-storage.adapter';

/**
 * Azure Blob storage.
 *
 * SCAFFOLD. The container exists (`noatum-quote-documents`) but the SDK is not a
 * dependency yet, so this reports itself unconfigured and refuses rather than
 * pretending to store anything. `AttachmentsService` turns that into an honest
 * "attachments are unavailable" instead of a lost file.
 *
 * Filling it in is one dependency - `@azure/storage-blob` with
 * `DefaultAzureCredential`, so the App Service managed identity authenticates and
 * no key is ever held - and the four method bodies below. Nothing else changes:
 * the port, the service, the controller and the database are already agnostic.
 */
@Injectable()
export class AzureBlobStorageAdapter extends FileStorageAdapter {
  private readonly logger = new Logger(AzureBlobStorageAdapter.name);
  private readonly accountName: string;

  constructor(config: ConfigService) {
    super();
    this.accountName = config.get<string>('storage.accountName') ?? '';

    if (this.accountName !== '') {
      this.logger.warn(
        'Azure Blob storage is selected but the client is not implemented yet; uploads will be refused.',
      );
    }
  }

  /** False until the SDK lands. An account name alone stores nothing. */
  isConfigured(): boolean {
    return false;
  }

  async put(_input: StoredFileInput): Promise<StoredFileHandle> {
    throw new Error('AzureBlobStorageAdapter.put: the blob client is not implemented yet.');
  }

  async get(_handle: StoredFileHandle): Promise<Buffer | null> {
    throw new Error('AzureBlobStorageAdapter.get: the blob client is not implemented yet.');
  }

  async delete(_handle: StoredFileHandle): Promise<void> {
    throw new Error('AzureBlobStorageAdapter.delete: the blob client is not implemented yet.');
  }
}
