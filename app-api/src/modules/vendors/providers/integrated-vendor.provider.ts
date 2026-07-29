import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  VENDOR_REASON,
  type VendorSourceMode,
} from '../../../contracts/vendor.contract';
import type { VendorSourceProvider } from './vendor-source.provider';

/**
 * Future-scope provider: vendors are mastered by an external system
 * (procurement / Oracle Fusion, etc.) and mirrored here read-only. The wiring
 * point exists today so integrated records can be stored and gated, but the
 * actual sync is intentionally **not implemented** and raises a typed error.
 * Replace {@link sync} with a real adapter when integration is prioritised.
 */
@Injectable()
export class IntegratedVendorProvider implements VendorSourceProvider {
  readonly mode: VendorSourceMode = 'Integrated';
  readonly supportsManualWrite = false;

  async sync(): Promise<void> {
    throw new NotImplementedException({
      title: 'Vendor integration is future scope',
      reasons: [VENDOR_REASON.integrationFutureScope],
    });
  }
}
