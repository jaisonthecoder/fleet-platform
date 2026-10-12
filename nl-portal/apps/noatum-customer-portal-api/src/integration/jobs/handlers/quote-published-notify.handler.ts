import { Injectable, Logger } from '@nestjs/common';

import { EmailAdapter } from '../../../contracts/adapters/email.adapter';
import { TenantRepository, type TenantClient } from '../../../common/tenancy/tenant.repository';
import { JobHandler, JOB_NAMES, type JobName } from '../job.registry';

export interface QuotePublishedPayload {
  quoteId: string;
  customerGroupId: string;
}

/**
 * Tells the customer their quote is ready.
 *
 * A job, not an inline send, for two reasons that both matter. Publishing must not
 * fail because a mail server is slow - the price is already recorded and the
 * customer can already see it, so a bounced send is a retry, not a rollback. And
 * `publish` writes this in its own transaction, so a quote can never end up
 * published with nobody told.
 *
 * The email itself contains NO PRICE. It says an answer is ready and links to the
 * portal, because a quote is commercially sensitive and mail is not a channel we
 * control - forwarded, quoted back, or read on a shared address, a figure in an
 * email outlives the validity date it was sent with.
 */
@Injectable()
export class QuotePublishedNotifyHandler extends JobHandler<QuotePublishedPayload> {
  readonly name: JobName = JOB_NAMES.QUOTE_PUBLISHED_NOTIFY;
  readonly tenantScoped = true;

  private readonly logger = new Logger(QuotePublishedNotifyHandler.name);

  constructor(
    private readonly repo: TenantRepository,
    private readonly email: EmailAdapter,
  ) {
    super();
  }

  async handle(payload: QuotePublishedPayload): Promise<void> {
    const { quote, recipients } = await this.repo.run(async (tx: TenantClient) => {
      const found = await tx.quote.findUnique({
        where: { id: payload.quoteId },
        select: { reference: true, status: true, originCode: true, destinationCode: true },
      });

      // Everyone in the group who may read quotes. Narrowed to active users so a
      // leaver's address is not still receiving commercial mail.
      const users = await tx.user.findMany({
        where: {
          customerGroupId: payload.customerGroupId,
          status: 'active',
          roles: { some: { role: { permissions: { some: { permissionKey: 'quotes.read' } } } } },
        },
        select: { email: true, displayName: true },
      });

      return { quote: found, recipients: users };
    });

    if (quote === null) {
      this.logger.warn(`Quote ${payload.quoteId} no longer exists; nothing to notify.`);
      return;
    }

    // Withdrawn or re-priced between publishing and this job running. Telling the
    // customer to look at something that is no longer there is worse than silence.
    if (quote.status !== 'published') {
      this.logger.log(`Quote ${quote.reference} is ${quote.status}; skipping notification.`);
      return;
    }

    if (recipients.length === 0) {
      this.logger.warn(`Quote ${quote.reference} has no active recipient in its customer group.`);
      return;
    }

    const result = await this.email.send({
      to: recipients.map((user) => ({ address: user.email, displayName: user.displayName })),
      subject: `Your quotation ${quote.reference} is ready`,
      text: [
        `Your quotation ${quote.reference} for ${quote.originCode} to ${quote.destinationCode} is ready.`,
        '',
        'Sign in to the Noatum customer portal to compare the options and accept the one you want.',
        '',
        'We are here if you have a question.',
      ].join('\n'),
      correlationId: payload.quoteId,
    });

    // `not-configured` is the expected state until the transport exists, and it is
    // not a failure: throwing would retry forever and fill the failed-job table.
    if (result.status === 'failed') {
      throw new Error(`Quote notification for ${quote.reference} failed: ${result.detail ?? 'unknown'}`);
    }

    this.logger.log(
      `Quote ${quote.reference} notification ${result.status} for ${recipients.length} recipient(s).`,
    );
  }
}
