import { Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../../common/tenancy/tenant-context';
import { TenantRepository } from '../../common/tenancy/tenant.repository';
import type { DashboardActionDto, DashboardAnalyticsDto, DashboardQuery } from '../../contracts';
import { sampleDashboard } from './dashboard.sample';

/** The dashboard reports in one currency. Multi-currency is a later question. */
const CURRENCY = 'EUR';

/**
 * The customer's analytics dashboard.
 *
 * Reads whatever the platform genuinely holds and generates the rest, saying
 * which is which. Today that means the quotation figures and the account's own
 * details are real, and everything CargoWise owns — shipments, milestones,
 * charges, invoices — is sample, because those tables do not exist yet.
 *
 * `source` travels with the response for that reason. It is not a debug flag:
 * a customer reading an invented figure as their own logistics spend is the
 * failure this endpoint is most able to cause, and the screen is required to
 * print what it was told.
 *
 * When the shipment tables land, the sample module goes and the reads below
 * widen. Nothing else on either side of the wire changes shape.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
  ) {}

  async analytics(query: DashboardQuery): Promise<DashboardAnalyticsDto> {
    const { userId } = this.context.require();

    return this.repo.run(async (tx) => {
      const groupId = this.context.requireGroupId();

      const [group, me, accounts, awaitingDecision, openQuotes] = await Promise.all([
        tx.customerGroup.findUnique({ where: { id: groupId } }),
        tx.user.findUnique({ where: { id: userId } }),
        tx.customerAccount.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { name: true },
        }),
        // Published and still inside its validity: the quotes actually waiting
        // on this customer, which is the one "needs you" card we can prove.
        tx.quote.count({
          where: { status: 'published', OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }] },
        }),
        tx.quote.count({ where: { status: { in: ['requested', 'claimed', 'priced', 'approved'] } } }),
      ]);

      if (!group || !me) throw new NotFoundException('Account not found.');

      const sample = sampleDashboard({
        seed: groupId,
        period: query.period,
        mode: query.mode,
        currency: CURRENCY,
        real: { openQuotes, quotesAwaitingDecision: awaitingDecision },
      });

      return {
        asOf: new Date().toISOString(),
        /*
         * One flag for the whole payload, deliberately.
         *
         * Marking it per panel would invite a screen that quietly presents the
         * sample panels as real and labels only the obvious ones. Until every
         * figure here comes from CargoWise, the honest answer for the screen is
         * that the dashboard is a sample.
         */
        source: 'sample' as const,
        period: query.period,
        mode: query.mode,
        currency: CURRENCY,

        customerName: group.name,
        firstName: me.displayName.split(' ')[0] ?? me.displayName,
        officeNames: accounts.map((account) => account.name),

        inFlightCount: sample.inFlight.stages.reduce((sum, stage) => sum + stage.count, 0),
        arrivingSoonCount: sample.inFlight.arrivingNext.length,

        actions: this.actions(awaitingDecision, sample),
        kpis: sample.kpis,
        monthly: sample.monthly,
        modeMix: sample.modeMix,
        inFlight: sample.inFlight,
        onTime: sample.onTime,
        transit: sample.transit,
        lanes: sample.lanes,
        spend: sample.spend,
        invoices: sample.invoices,
        emissions: sample.emissions,
      };
    });
  }

  /**
   * What is waiting on the customer.
   *
   * The quotation card is REAL — it counts published quotes still inside their
   * validity, which is a fact the platform holds. The other three describe
   * events in the shipment and finance data that does not exist yet, so they
   * travel with the sample and disappear the day the real feed replaces it.
   *
   * Ordered by what it costs to ignore: a decision that expires, cargo that is
   * accruing charges, then money.
   */
  private actions(
    awaitingDecision: number,
    sample: ReturnType<typeof sampleDashboard>,
  ): DashboardActionDto[] {
    const actions: DashboardActionDto[] = [];

    if (awaitingDecision > 0) {
      actions.push({
        key: 'quote_decision',
        title:
          awaitingDecision === 1
            ? 'A quotation is waiting for your decision'
            : `${awaitingDecision} quotations are waiting for your decision`,
        detail: 'Options are priced and held until their validity runs out.',
        badge: 'Awaiting you',
        tone: 'action',
        cta: 'Review',
        href: '/app/quotations?view=needs_decision',
      });
    }

    const held = sample.inFlight.arrivingNext.find((entry) => entry.tone === 'action');
    if (held) {
      actions.push({
        key: 'customs_hold',
        title: `Import clearance held on ${held.reference}`,
        detail: held.note,
        badge: 'Customs hold',
        tone: 'warning',
        cta: 'Upload',
        href: '',
      });
    }

    const expiring = sample.inFlight.arrivingNext.find((entry) => entry.tone === 'warning');
    if (expiring) {
      actions.push({
        key: 'free_time',
        title: `Book delivery for ${expiring.reference}`,
        detail: expiring.note,
        badge: 'Free time running',
        tone: 'warning',
        cta: 'Book',
        href: '',
      });
    }

    if (sample.invoices.overdueMinorUnits > 0) {
      actions.push({
        key: 'overdue_invoice',
        title: 'An invoice is past its terms',
        detail: `${CURRENCY} ${(sample.invoices.overdueMinorUnits / 100).toLocaleString('en-GB')} is over ${sample.invoices.termsDays} days.`,
        badge: 'Overdue',
        tone: 'action',
        cta: 'View',
        href: '',
      });
    }

    return actions;
  }
}
