import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { messagingConfig } from '../config/messaging.config';
import { InboxService } from './inbox.service';
import { LogMessagePublisher } from './log-message-publisher';
import { MESSAGE_PUBLISHER } from './message-publisher';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxService } from './outbox.service';
import { ServiceBusMessagePublisher } from './service-bus-message-publisher';

/**
 * Global transactional-eventing module: the outbox writer + dispatcher, the
 * inbox idempotency ledger, and the transport. The transport is selected at
 * wiring time — the real Azure Service Bus publisher when a connection string
 * is configured, otherwise the log publisher so local/dev/test run the whole
 * outbox path without external infrastructure.
 */
@Global()
@Module({
  providers: [
    OutboxService,
    OutboxDispatcherService,
    InboxService,
    ServiceBusMessagePublisher,
    LogMessagePublisher,
    {
      provide: MESSAGE_PUBLISHER,
      inject: [messagingConfig.KEY, ServiceBusMessagePublisher, LogMessagePublisher],
      /** Real Service Bus transport when configured; log transport otherwise. */
      useFactory: (
        config: ConfigType<typeof messagingConfig>,
        serviceBus: ServiceBusMessagePublisher,
        log: LogMessagePublisher,
      ) => (config.serviceBus.connectionString ? serviceBus : log),
    },
  ],
  exports: [OutboxService, OutboxDispatcherService, InboxService, MESSAGE_PUBLISHER],
})
export class MessagingModule {}
