import { Injectable } from '@nestjs/common';
import type { VendorSourceMode } from '../../../contracts/vendor.contract';
import type { VendorSourceProvider } from './vendor-source.provider';

/**
 * Default provider: vendors are created, edited and owned in-app. This backs
 * both the "native app module" and "manual data entry" adoption styles.
 */
@Injectable()
export class ManualVendorProvider implements VendorSourceProvider {
  readonly mode: VendorSourceMode = 'Manual';
  readonly supportsManualWrite = true;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async sync(): Promise<void> {
    // No external system to pull from — manual records are already authoritative.
  }
}
