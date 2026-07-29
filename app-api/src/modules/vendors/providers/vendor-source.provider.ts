import type { VendorSourceMode } from '../../../contracts/vendor.contract';

/**
 * Plug-and-play seam for how an organization masters vendor records (S1).
 *
 * The vendor module ships two providers and can gain more without touching the
 * service layer:
 *  - `Manual` — records are created and owned in-app. Covers the "app feature /
 *    module" and "manual data entry" adoption styles. Always available.
 *  - `Integrated` — records are mastered by an external system (e.g. procurement
 *    / Fusion) and mirrored here read-only. The sync itself is **future scope**;
 *    the provider exists now so integrated records coexist and in-app writes are
 *    correctly gated.
 *
 * An organization selects its default mode via settings (future); individual
 * records also carry their own `sourceMode`, so mixed estates are supported.
 */
export interface VendorSourceProvider {
  /** The source mode this provider governs. */
  readonly mode: VendorSourceMode;
  /** Whether records in this mode may be created/edited directly in-app. */
  readonly supportsManualWrite: boolean;
  /**
   * Pulls records from the external system of record. Manual mode is a no-op;
   * integrated mode is a future-scope stub that raises a typed error.
   */
  sync(): Promise<void>;
}

/** DI token collecting every registered {@link VendorSourceProvider}. */
export const VENDOR_SOURCE_PROVIDERS = Symbol('VENDOR_SOURCE_PROVIDERS');
