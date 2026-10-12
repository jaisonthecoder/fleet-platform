import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { EmailAdapter } from '../contracts/adapters/email.adapter';
import { RateEngineAdapter } from '../contracts/adapters/rate-engine.adapter';
import { TmsQuoteAdapter } from '../contracts/adapters/tms-quote.adapter';
import { TmsTrackingAdapter } from '../contracts/adapters/tms-tracking.adapter';

import { Cw1Client } from './cw1/cw1.client';
import { Cw1QuoteAdapter } from './cw1/cw1-quote.adapter';
import { Cw1RateAdapter } from './cw1/cw1-rate.adapter';
import { Cw1ShipmentAdapter } from './cw1/cw1-shipment.adapter';
import { XmlCodec } from './cw1/xml.codec';
import { JOB_HANDLERS_TOKEN, type JobHandler } from './jobs/job.registry';
import { IntegrationRelayHandler } from './jobs/handlers/integration-relay.handler';
import { IntegrationRetentionHandler } from './jobs/handlers/integration-retention.handler';
import { MasterOrgSyncHandler } from './jobs/handlers/master-org-sync.handler';
import { QuoteExpiryFanoutHandler } from './jobs/handlers/quote-expiry-fanout.handler';
import { QuoteExpiryHandler } from './jobs/handlers/quote-expiry.handler';
import { QuotePublishedNotifyHandler } from './jobs/handlers/quote-published-notify.handler';
import { ShipmentRefreshHandler } from './jobs/handlers/shipment-refresh.handler';
import { JobsService } from './jobs/jobs.service';
import { AzureEmailAdapter } from './email/azure-email.adapter';
import { IntegrationMessageService } from './messages/integration-message.service';
import { IntegrationSyncController } from './messages/integration-sync.controller';
import { MappingService } from './mapping/mapping.service';
import { OrganisationImportService } from './organisations/organisation-import.service';
import { TenantResolverService } from './tenant-resolver/tenant-resolver.service';

/**
 * Platform module.
 *
 * Everything that talks to CargoWise, plus the in-process job runner.
 *
 * The seam that matters: feature modules import the abstract *Adapter classes, and this
 * module decides what backs them. Locally and in test that is apps/cw1-simulator, in
 * production the real eAdapter - with no change in feature code. The simulator is never
 * imported here; it is reached over HTTP via configuration.
 */
@Module({
  imports: [HttpModule.register({ timeout: 15_000, maxRedirects: 0 })],
  controllers: [IntegrationSyncController],
  providers: [
    XmlCodec,
    Cw1Client,
    MappingService,
    TenantResolverService,
    OrganisationImportService,
    IntegrationMessageService,
    JobsService,
    MasterOrgSyncHandler,
    ShipmentRefreshHandler,
    QuoteExpiryHandler,
    QuoteExpiryFanoutHandler,
    IntegrationRelayHandler,
    IntegrationRetentionHandler,
    QuotePublishedNotifyHandler,
    {
      provide: JOB_HANDLERS_TOKEN,
      useFactory: (...handlers: JobHandler[]) => handlers,
      inject: [
        MasterOrgSyncHandler,
        ShipmentRefreshHandler,
        QuoteExpiryHandler,
        QuoteExpiryFanoutHandler,
        IntegrationRelayHandler,
        IntegrationRetentionHandler,
        QuotePublishedNotifyHandler,
      ],
    },

    { provide: TmsTrackingAdapter, useClass: Cw1ShipmentAdapter },
    { provide: RateEngineAdapter, useClass: Cw1RateAdapter },
    { provide: EmailAdapter, useClass: AzureEmailAdapter },
    // Bound even though no transport exists: C2's principle is that the operation
    // is always callable and answers honestly that it is held.
    { provide: TmsQuoteAdapter, useClass: Cw1QuoteAdapter },
  ],
  exports: [
    // Ports only. The concrete Cw1* classes are deliberately not exported: a feature module
    // that could inject one would be bound to CargoWise, which foundation rule 2 forbids.
    // TmsBooking, TmsFinance, TmsDocument, TmsOrganisation and Emissions have no
    // implementation yet and are therefore not bound - injecting one must fail at
    // startup, loudly.
    RateEngineAdapter,
    EmailAdapter,
    TmsTrackingAdapter,
    TmsQuoteAdapter,
    MappingService,
    OrganisationImportService,
    TenantResolverService,
    JobsService,
    // Business modules record what they intend to exchange; only this module knows
    // whether anything carries it.
    IntegrationMessageService,
  ],
})
export class IntegrationModule {}
