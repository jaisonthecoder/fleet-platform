import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  EmailAdapter,
  type EmailDeliveryResult,
  type EmailMessage,
} from '../../contracts/adapters/email.adapter';

/**
 * Azure Communication Services email.
 *
 * INCOMPLETE BY INSTRUCTION. The connection string and sender address come from the
 * Azure resource, which has not been provisioned yet, so this deliberately stops at
 * the point of calling the service:
 *
 *   - when nothing is configured it returns `not-configured` and logs what WOULD have
 *     been sent, so the invitation flow is usable and honest in the meantime;
 *   - when configuration does arrive, `deliver()` below is the only method to fill in,
 *     using @azure/communication-email's EmailClient. Everything around it — the
 *     interface, the config, the audit, the human-in-the-loop rule — is already right.
 *
 * Why Azure Communication Services rather than Graph: sending as a no-reply service
 * identity does not require a mailbox or delegated user consent, and the sender domain
 * is verified once against the resource. Revisit if Noatum's tenant policy says
 * otherwise — that is a decision for whoever provisions it.
 */
@Injectable()
export class AzureEmailAdapter extends EmailAdapter {
  private readonly logger = new Logger(AzureEmailAdapter.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(this.connectionString && this.senderAddress);
  }

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.isConfigured()) {
      // Never throw: a missing transport must not break the business write that
      // asked for the email. The caller surfaces the status instead.
      this.logger.warn(
        {
          to: message.to.map((recipient) => recipient.address),
          subject: message.subject,
          correlationId: message.correlationId,
        },
        'Email not sent: no transport is configured yet',
      );
      return {
        status: 'not-configured',
        providerMessageId: null,
        detail: 'No email transport is configured. Send this message yourself for now.',
      };
    }

    return this.deliver(message);
  }

  /**
   * The one method to implement once AZURE_COMMUNICATION_CONNECTION_STRING and
   * AZURE_COMMUNICATION_SENDER are real.
   *
   * Sketch, for whoever finishes it:
   *   const client = new EmailClient(this.connectionString);
   *   const poller = await client.beginSend({
   *     senderAddress: this.senderAddress,
   *     content: { subject, plainText: text, html },
   *     recipients: { to: message.to.map(...) },
   *   });
   *   const result = await poller.pollUntilDone();
   *   return { status: 'sent', providerMessageId: result.id };
   *
   * Keep it idempotent per invitation and never retry a send that may already have
   * left, or a recipient gets the same invitation twice with two different tokens.
   */
  private async deliver(message: EmailMessage): Promise<EmailDeliveryResult> {
    this.logger.error(
      { subject: message.subject, correlationId: message.correlationId },
      'Azure email transport is configured but delivery is not implemented yet',
    );
    return {
      status: 'failed',
      providerMessageId: null,
      detail: 'The Azure email transport is configured but not implemented. Finish AzureEmailAdapter.deliver().',
    };
  }

  private get connectionString(): string {
    return this.config.get<string>('email.azureConnectionString') ?? '';
  }

  private get senderAddress(): string {
    return this.config.get<string>('email.senderAddress') ?? '';
  }
}
