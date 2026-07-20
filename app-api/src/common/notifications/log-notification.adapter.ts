import { Injectable, Logger } from '@nestjs/common';
import type { NotificationMessage, NotificationPort } from './notification.port';

/**
 * Default notification transport for local/dev/test — logs the delivery and
 * succeeds, so the compliance-ladder / reminder path runs end-to-end without an
 * Email/M365 connection. Replaced by the Graph adapter when configured.
 */
@Injectable()
export class LogNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(LogNotificationAdapter.name);

  async deliver(message: NotificationMessage): Promise<void> {
    this.logger.log(
      `notification delivered [${message.category}/${message.channel}] to=${message.toRef} subject="${message.subject}"` +
        (message.correlationId ? ` correlation=${message.correlationId}` : ''),
    );
  }
}
