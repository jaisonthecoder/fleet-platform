/** DI token for the notification delivery transport. */
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

/** Delivery channels a notification may target. */
export type NotificationChannel = 'email' | 'push' | 'sms';

/**
 * Notification categories. `compliance` messages are **unmutable** (policy
 * floor): they are delivered regardless of a recipient's mute preferences —
 * an expiring insurance alert cannot be silenced. All other categories are
 * suppressible per preference.
 */
export type NotificationCategory = 'compliance' | 'operational' | 'informational';

/** A notification to deliver. */
export interface NotificationMessage {
  category: NotificationCategory;
  channel: NotificationChannel;
  toRef: string;
  subject: string;
  body: string;
  correlationId?: string;
}

/**
 * Delivery transport port. The real Email/M365 (Graph) adapter is selected when
 * configured; a log adapter is used in local/dev/test so the notification path
 * runs without external infrastructure.
 */
export interface NotificationPort {
  /** Delivers one notification; throws on transport failure (caller decides retry). */
  deliver(message: NotificationMessage): Promise<void>;
}

/** True when a message may be suppressed by recipient preference (never compliance). */
export function isSuppressible(message: NotificationMessage): boolean {
  return message.category !== 'compliance';
}
