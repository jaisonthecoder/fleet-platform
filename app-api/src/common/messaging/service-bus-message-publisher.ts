import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  type ServiceBusClient,
  type ServiceBusSender,
  ServiceBusClient as ServiceBusClientCtor,
} from '@azure/service-bus';
import { messagingConfig } from '../config/messaging.config';
import type { MessagePublisher, OutboxMessage } from './message-publisher';

/**
 * Azure Service Bus transport. Selected over {@link LogMessagePublisher} only
 * when `SERVICE_BUS_CONNECTION_STRING` is configured (see MessagingModule). The
 * client + sender are created lazily on first publish so boot never depends on
 * Service Bus reachability. `messageId` is set for broker-side dedupe; the
 * dispatcher still owns retry/DLQ.
 */
@Injectable()
export class ServiceBusMessagePublisher
  implements MessagePublisher, OnApplicationShutdown
{
  private readonly logger = new Logger(ServiceBusMessagePublisher.name);
  private client?: ServiceBusClient;
  private sender?: ServiceBusSender;

  constructor(
    @Inject(messagingConfig.KEY)
    private readonly config: ConfigType<typeof messagingConfig>,
  ) {}

  private getSender(): ServiceBusSender {
    if (!this.sender) {
      const connectionString = this.config.serviceBus.connectionString;
      if (!connectionString) {
        throw new Error('SERVICE_BUS_CONNECTION_STRING is not configured');
      }
      this.client = new ServiceBusClientCtor(connectionString);
      this.sender = this.client.createSender(this.config.serviceBus.topic);
    }
    return this.sender;
  }

  async publish(message: OutboxMessage): Promise<void> {
    await this.getSender().sendMessages({
      messageId: message.messageId,
      correlationId: message.correlationId ?? undefined,
      subject: message.eventType,
      body: message.payload,
      applicationProperties: {
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        schemaVersion: message.schemaVersion,
      },
    });
  }

  /** Closes the sender + client on graceful shutdown. */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.sender?.close();
      await this.client?.close();
    } catch (error) {
      this.logger.warn(
        `Service Bus close failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
