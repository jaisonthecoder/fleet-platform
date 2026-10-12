/**
 * Outbound email, behind an interface.
 *
 * Two rules shape this. Nothing here sends without a human act — an invitation is
 * sent because a person pressed a button, never because a job decided to. And the
 * transport is swappable: the platform must not care whether delivery is Azure
 * Communication Services, Microsoft Graph or a relay.
 *
 * SCAFFOLD. No transport is configured yet. Until the Azure resource exists, the
 * provider records the message and reports it as not sent, so the caller can show
 * the operator what would have gone out instead of pretending it left.
 */

export interface EmailAddress {
  address: string;
  displayName?: string;
}

export interface EmailMessage {
  to: EmailAddress[];
  subject: string;
  /** Plain text is mandatory; HTML is the enhancement, not the other way round. */
  text: string;
  html?: string;
  /** Ties the send to the thing that caused it, for audit and for support. */
  correlationId?: string;
}

export type EmailDeliveryStatus = 'sent' | 'queued' | 'not-configured' | 'failed';

export interface EmailDeliveryResult {
  status: EmailDeliveryStatus;
  /** The provider's id when there is one; null while no transport is configured. */
  providerMessageId: string | null;
  /** Why a send did not happen, in words an operator can act on. */
  detail?: string;
}

/**
 * Implemented by the integration module. Business code depends on this class, never
 * on a provider SDK.
 */
export abstract class EmailAdapter {
  abstract send(message: EmailMessage): Promise<EmailDeliveryResult>;

  /** True when a real transport is configured, so screens can say so honestly. */
  abstract isConfigured(): boolean;
}
