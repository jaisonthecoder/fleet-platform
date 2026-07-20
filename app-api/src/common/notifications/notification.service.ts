import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  isSuppressible,
  NOTIFICATION_PORT,
  type NotificationMessage,
  type NotificationPort,
} from './notification.port';

/** Outcome of a send attempt. */
export type SendResult = 'delivered' | 'suppressed' | 'failed';

/**
 * Notification dispatcher (P9). Enforces the **policy floor**: compliance
 * notifications are unmutable and are delivered even when the recipient has
 * muted the relevant preference; all other categories may be suppressed. Best-
 * effort at the boundary — a transport failure is reported, never thrown back
 * into the domain flow that requested the notification (callers that need
 * guaranteed delivery enqueue via the outbox instead).
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(NOTIFICATION_PORT) private readonly transport: NotificationPort,
  ) {}

  /**
   * Sends a notification, honouring the mute preference only for suppressible
   * categories. Returns whether it was delivered, suppressed by preference, or
   * failed at the transport.
   */
  async send(message: NotificationMessage, muted = false): Promise<SendResult> {
    if (muted && isSuppressible(message)) {
      return 'suppressed';
    }
    try {
      await this.transport.deliver(message);
      return 'delivered';
    } catch (error) {
      this.logger.error(
        `notification delivery failed [${message.category}/${message.channel}] to=${message.toRef}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return 'failed';
    }
  }
}
