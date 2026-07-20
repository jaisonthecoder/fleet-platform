import { Injectable, Logger } from '@nestjs/common';
import type { MessagePublisher, OutboxMessage } from './message-publisher';

/**
 * Default transport used when no Azure Service Bus connection is configured
 * (local/dev/test). It logs the event and succeeds, so the full outbox →
 * dispatch → mark-published path runs end-to-end without external infra. The
 * real {@link ServiceBusMessagePublisher} replaces it when configured.
 */
@Injectable()
export class LogMessagePublisher implements MessagePublisher {
  private readonly logger = new Logger(LogMessagePublisher.name);

  async publish(message: OutboxMessage): Promise<void> {
    this.logger.log(
      `event published [${message.eventType}] aggregate=${message.aggregateType}:${message.aggregateId} messageId=${message.messageId}` +
        (message.correlationId ? ` correlation=${message.correlationId}` : ''),
    );
  }
}
