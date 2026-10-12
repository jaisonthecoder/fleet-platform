import 'reflect-metadata';

import { EmailAdapter } from '../contracts/adapters/email.adapter';
import { RateEngineAdapter } from '../contracts/adapters/rate-engine.adapter';
import { TmsQuoteAdapter } from '../contracts/adapters/tms-quote.adapter';
import { TmsTrackingAdapter } from '../contracts/adapters/tms-tracking.adapter';

import { Cw1QuoteAdapter } from './cw1/cw1-quote.adapter';
import { Cw1RateAdapter } from './cw1/cw1-rate.adapter';
import { Cw1ShipmentAdapter } from './cw1/cw1-shipment.adapter';
import { IntegrationModule } from './integration.module';

/**
 * Reads the module's decorator metadata rather than bootstrapping Nest, so this needs no
 * database, no configuration and no network.
 */
const providers: any[] = Reflect.getMetadata('providers', IntegrationModule) ?? [];
const exported: any[] = Reflect.getMetadata('exports', IntegrationModule) ?? [];

const boundTo = (token: unknown) =>
  providers.find((provider) => provider && provider.provide === token)?.useClass;

describe('IntegrationModule adapter bindings', () => {
  it('binds TmsTrackingAdapter to the CargoWise implementation', () => {
    expect(boundTo(TmsTrackingAdapter)).toBe(Cw1ShipmentAdapter);
  });

  it('binds RateEngineAdapter to the CargoWise implementation', () => {
    expect(boundTo(RateEngineAdapter)).toBe(Cw1RateAdapter);
  });

  it('exports ports and never the concrete CargoWise classes', () => {
    expect(exported).toContain(TmsTrackingAdapter);
    expect(exported).toContain(RateEngineAdapter);
    expect(exported).toContain(EmailAdapter);
    expect(exported).not.toContain(Cw1ShipmentAdapter);
    expect(exported).not.toContain(Cw1RateAdapter);
  });

  it('binds the quote port even though no transport is agreed', () => {
    // C2 changed this deliberately. The port answers `recorded` - held safely,
    // not sent - so business code can name the operation today. Leaving it
    // unbound would force callers to decide for themselves whether CargoWise
    // exists, which is the coupling the port exists to prevent.
    expect(boundTo(TmsQuoteAdapter)).toBe(Cw1QuoteAdapter);
    expect(exported).toContain(TmsQuoteAdapter);
    expect(exported).not.toContain(Cw1QuoteAdapter);
  });

  it('leaves the still-unimplemented ports unbound so injecting one fails at startup', () => {
    const provided = providers.map((provider) => provider?.provide ?? provider).filter(Boolean);
    const names = provided.map((token: any) => token?.name).filter(Boolean);

    for (const port of [
      'TmsBookingAdapter',
      'TmsFinanceAdapter',
      'TmsDocumentAdapter',
      'TmsOrganisationAdapter',
      'EmissionsAdapter',
    ]) {
      expect(names).not.toContain(port);
    }
  });
});
