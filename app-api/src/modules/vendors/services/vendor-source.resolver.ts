import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  VENDOR_REASON,
  type VendorSourceMode,
} from '../../../contracts/vendor.contract';
import {
  VENDOR_SOURCE_PROVIDERS,
  type VendorSourceProvider,
} from '../providers/vendor-source.provider';

/**
 * Resolves the {@link VendorSourceProvider} for a record's source mode and
 * enforces the write gate. This is the single place the service consults, so
 * adding a new source mode never touches business logic.
 */
@Injectable()
export class VendorSourceResolver {
  private readonly byMode: Map<VendorSourceMode, VendorSourceProvider>;

  constructor(
    @Inject(VENDOR_SOURCE_PROVIDERS) providers: VendorSourceProvider[],
  ) {
    this.byMode = new Map(providers.map((p) => [p.mode, p]));
  }

  /** Returns the registered provider for a source mode and fails closed otherwise. */
  resolve(mode: VendorSourceMode): VendorSourceProvider {
    const provider = this.byMode.get(mode);
    if (!provider) {
      throw new InternalServerErrorException({
        title: 'Vendor source provider is not configured',
        reasons: [`vendor-source-provider-missing:${mode}`],
      });
    }
    return provider;
  }

  /** Throws when a record's mode does not permit in-app create/edit. */
  assertManualWrite(mode: VendorSourceMode): void {
    if (!this.resolve(mode).supportsManualWrite) {
      throw new ForbiddenException({
        title: 'Vendor record is mastered externally and is read-only in-app',
        reasons: [VENDOR_REASON.integratedReadOnly],
      });
    }
  }
}
