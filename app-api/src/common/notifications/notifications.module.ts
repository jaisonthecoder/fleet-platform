import { Global, Module } from '@nestjs/common';
import { LogNotificationAdapter } from './log-notification.adapter';
import { NOTIFICATION_PORT } from './notification.port';
import { NotificationService } from './notification.service';

/**
 * Global notification module (P9). Provides the dispatcher + the delivery
 * transport. The transport is the log adapter by default; the Email/M365 (Graph)
 * adapter is wired here when configured. Consumed by compliance ladders and
 * booking reminders (Sub-Phase 1D).
 */
@Global()
@Module({
  providers: [
    NotificationService,
    LogNotificationAdapter,
    { provide: NOTIFICATION_PORT, useExisting: LogNotificationAdapter },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
