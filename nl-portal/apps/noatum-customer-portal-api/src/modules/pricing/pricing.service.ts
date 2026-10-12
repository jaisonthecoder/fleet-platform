import type { Prisma } from '@prisma/client';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  PERMISSIONS,
  QUOTE_PIPELINE_SEGMENTS,
  REFERENCE_CATEGORIES,
  dangerousGoodsFor,
  equipmentFor,
  oversizeItemsFor,
  temperatureControlFor,
  priceQuoteSchema,
  type PriceQuoteInput,
  type PricingQuotationListDto,
  type PricingQuoteDto,
  type QuoteStatus,
} from '../../contracts';

import { AnalyticsService } from '../../common/analytics/analytics.service';
import { FeatureSwitchService } from '../../common/features/feature-switch.service';
import { SettingsService } from '../../common/settings/settings.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { TenantRepository, type TenantClient } from '../../common/tenancy/tenant.repository';
import type { AssistInput, PricingAssistDto } from '../ai-intake/pricing/ai-pricing.dto';
import { AiPricingService } from '../ai-intake/pricing/ai-pricing.service';
import {
  INTEGRATION_OPERATIONS,
  IntegrationMessageService,
} from '../../integration/messages/integration-message.service';
import { JOB_NAMES } from '../../integration/jobs/job.registry';
import { JobsService } from '../../integration/jobs/jobs.service';
import { ReferenceService } from '../reference/reference.service';
import { assertTransition } from '../quotes/quote.status';
import { cargoFor } from '../quotes/quote-cargo';
import { quoteFilterWhere } from '../quotes/quote-filters';
import {
  countPipeline,
  daysRemaining,
  isPipelineSegment,
  pipelineSegmentFor,
  pipelineSegmentWhere,
} from '../quotes/quote-pipeline';

/** What the pricing queue shows. Terminal and draft quotes are nobody's work. */
const QUEUE_STATUSES = ['requested', 'claimed', 'priced', 'approved'] as const;

/**
 * A quote no branch owns: no account servicing branch, and no customer default.
 *
 * Shared by the queue and the claim check so the two cannot drift - showing a
 * request in someone's queue and then refusing their claim is worse than hiding
 * it, because it looks like a bug rather than a routing gap.
 */
const UNROUTED_QUOTE_FILTERS = [
  { accountId: null, group: { defaultServicingBranchId: null } },
  { account: { servicingBranchId: null } },
] as const;
/** A quote can be priced from any of these. Anything else is a status error, not a 404. */
const PRICEABLE_FROM = ['requested', 'claimed', 'priced', 'approved', 'published'] as const;

/**
 * The currency the approval threshold is expressed in.
 *
 * `quotations.threshold` stores a bare number, so a threshold of 15000 has to mean
 * fifteen thousand OF something. Until the setting carries its own currency, that
 * something is stated here rather than left implicit - comparing a JPY total against a
 * EUR threshold as bare integers would skip four-eyes on a quote two orders of magnitude
 * over it. Recorded in docs/gaps.md.
 */
const THRESHOLD_CURRENCY = 'EUR';

/** Shown whenever a conditional update finds the row already moved. */
const CONCURRENT_CHANGE =
  'This quote changed while you were working on it. Please reload it and try again.';

/**
 * Initials for the owner caption, from whatever the directory holds.
 *
 * First and last word, so "Jorge Ruiz" is JR and "María de la Cruz Pérez" is MP
 * rather than MDLCP. Null when nobody holds it - the grid prints "unclaimed"
 * rather than a placeholder that looks like a person.
 */
function initialsOf(displayName: string | null): string | null {
  if (!displayName) return null;
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toLocaleUpperCase() || null;
}

/**
 * Margin on one option, as a percentage of sell, to one decimal.
 *
 * The same subtraction the detail screen performs, and for the same reason it is
 * not stored: a saved copy of sell minus cost is a second source of truth waiting
 * to disagree. Null unless a cost was actually recorded - "never costed" and
 * "costed at zero" are different answers and only one of them is 100% margin.
 */
function marginOf(
  option: {
    totalMinorUnits: bigint | null;
    // `cost` is optional, not merely nullable: a conditional Prisma select types
    // the lines as the whole model, on which the cost RELATION is absent rather
    // than null. `!= null` below catches both, so a caller that did not load the
    // costs reads as "never costed" instead of as a 100% margin.
    chargeLines?: { quantity: unknown; cost?: { costMinorUnits: bigint } | null }[] | false;
  } | null,
): number | null {
  if (!option || !option.chargeLines) return null;
  const lines = option.chargeLines;
  if (!lines.some((line) => line.cost != null)) return null;

  const sell = Number(option.totalMinorUnits ?? 0);
  if (sell === 0) return null;

  // Cost is a rate, like the sell rate beside it: 320.00 against two containers
  // means per container. So it is the sum of quantity x cost, not of the costs.
  const cost = lines.reduce(
    (sum, line) =>
      sum +
      Math.trunc((Math.round(Number(line.quantity) * 1000) * Number(line.cost?.costMinorUnits ?? 0)) / 1000),
    0,
  );

  return Math.round(((sell - cost) / sell) * 1000) / 10;
}

export interface QueueEntry {
  id: string;
  reference: string;
  status: string;
  mode: string;
  originCode: string;
  destinationCode: string;
  customerName: string | null;
  createdAt: string;
  claimedById: string | null;
  claimedAt: string | null;
  claimedByName: string | null;
  claimedByMe: boolean;
  /** Null when unclaimed. Lets the screen count down without re-deriving the setting. */
  claimExpiresAt: string | null;
}

/**
 * The pricing queue, and who is working on what.
 *
 * Internal only, at every entrance. Nothing here is reachable by a customer session:
 * `runInternal` throws rather than returning an empty list, because a silent empty
 * result is indistinguishable from "no work today" and would hide the bug.
 */
@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
    private readonly settings: SettingsService,
    private readonly analytics: AnalyticsService,
    private readonly jobs: JobsService,
    private readonly messages: IntegrationMessageService,
    private readonly reference: ReferenceService,
    private readonly switches: FeatureSwitchService,
    /* Optional because pricing does not need it to price: the assistant only ever
       drafts. Tests construct this service without one, and the module always
       provides one. */
    @Optional() private readonly assistant?: AiPricingService,
  ) {}

  /**
   * Branch-scoped by default, because the mockup's queue is headed "Pricing queue ·
   * Valencia" and a specialist in one branch has no business pricing another's work.
   * `pricing.cross_branch` lifts the scope; it is never implied by a pricing role.
   *
   * A quote carries no branch of its own, so the servicing branch is resolved through
   * the account that was quoted for, falling back to the customer's default servicing
   * branch when the request did not name an account. That is a lookup, not a copy - see
   * docs/gaps.md F3 for why the quote should eventually carry its own.
   */
  async queue(): Promise<QueueEntry[]> {
    const actor = this.require();
    const crossBranch = actor.permissions.has(PERMISSIONS.PRICING_CROSS_BRANCH);
    const expiryHours = await this.claimExpiryHours();

    if (!crossBranch && (actor.branchCode ?? '') === '') {
      // A branchless internal user without the cross-branch grant sees nothing rather
      // than everything. Failing to an empty queue is the safe direction, and it is a
      // configuration problem to be fixed on the staff record, not here.
      this.logger.warn(`User ${actor.userId} has no branch and no cross-branch grant.`);
      return [];
    }

    const branchFilter = this.branchFilter(crossBranch, actor.branchCode ?? '');

    return this.repo.runInternal(async (tx) => {
      const rows = await tx.quote.findMany({
        where: {
          status: { in: [...QUEUE_STATUSES] },
          ...branchFilter,
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
        include: {
          claimedBy: { select: { displayName: true } },
          group: { select: { name: true } },
        },
      });

      return rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        status: row.status,
        mode: row.mode,
        originCode: row.originCode,
        destinationCode: row.destinationCode,
        customerName: row.group?.name ?? null,
        createdAt: row.createdAt.toISOString(),
        claimedById: row.claimedById,
        claimedAt: row.claimedAt?.toISOString() ?? null,
        claimedByName: row.claimedBy?.displayName ?? null,
        claimedByMe: row.claimedById === actor.userId,
        claimExpiresAt:
          row.claimedAt === null
            ? null
            : new Date(row.claimedAt.getTime() + expiryHours * 3_600_000).toISOString(),
      }));
    });
  }

  /**
   * The branch scope, as a `where` fragment.
   *
   * Extracted so the queue and the quotation list cannot answer "is this mine to
   * work on" differently. A list that shows a quote the claim check then refuses
   * looks like a bug rather than a routing gap.
   */
  private branchFilter(crossBranch: boolean, branchCode: string): Prisma.QuoteWhereInput {
    return crossBranch
      ? {}
      : {
          OR: [
            { account: { servicingBranch: { code: branchCode } } },
            { accountId: null, group: { defaultServicingBranch: { code: branchCode } } },
            // A request that resolves to no branch at all belongs in everyone's
            // queue rather than nobody's. Go-live now demands a servicing office,
            // but deleting a branch nulls it again (ON DELETE SET NULL), and a
            // customer waiting on a quote no queue shows is the worst outcome
            // available. Whoever sees it first can claim it.
            ...UNROUTED_QUOTE_FILTERS,
          ],
        };
  }

  /**
   * Everything this branch has quoted, a page at a time.
   *
   * Distinct from `queue()`, which is the work list: this one carries terminal
   * quotes too, because the grid's pipeline band has to be able to say how many
   * were accepted and how many lapsed. Paged in the database rather than filtered
   * in the browser - the old screen fetched the queue whole and sliced it in
   * React, which cannot meet the 100k-row budget and never could.
   */
  async quotations(params: {
    search?: string;
    segment?: string;
    view?: string;
    mode?: string;
    requestedFrom?: string;
    requestedTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PricingQuotationListDto> {
    const actor = this.require();
    const crossBranch = actor.permissions.has(PERMISSIONS.PRICING_CROSS_BRANCH);
    const expiryHours = await this.claimExpiryHours();
    const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);
    const page = Math.max(params.page ?? 1, 1);
    const search = params.search?.trim() ?? '';
    // One clock for the band, the filter and every row in the answer.
    const now = new Date();

    const empty: PricingQuotationListDto = {
      items: [],
      total: 0,
      pipeline: QUOTE_PIPELINE_SEGMENTS.map((key) => ({ key, count: 0 })),
      unclaimed: 0,
      maySeeMargin: false,
    };

    if (!crossBranch && (actor.branchCode ?? '') === '') {
      // Same posture as the queue: a branchless user without the cross-branch
      // grant sees nothing rather than everything.
      this.logger.warn(`User ${actor.userId} has no branch and no cross-branch grant.`);
      return empty;
    }

    /*
     * Cost is gated twice, and the two gates mean different things: the setting
     * says this branch records cost at all, the permission says this person may
     * look at it. Margin needs both, and when either is missing the column is
     * not drawn rather than drawn full of dashes - an empty column invites
     * somebody to ask what is broken.
     */
    const costCapture = await this.settings.get(
      'quotations.costCapture',
      this.settings.scopeOf(actor),
    );
    const maySeeMargin =
      Boolean(costCapture) && actor.permissions.has(PERMISSIONS.PRICING_COST_VIEW);

    const scope: Prisma.QuoteWhereInput = {
      AND: [
        this.branchFilter(crossBranch, actor.branchCode ?? ''),
        // Drafts are the customer's own unsent paperwork. They are nobody's work
        // here and were never in the queue either.
        { status: { not: 'draft' } },
        // The drawer's filters join the scope, so the band counts within them.
        ...quoteFilterWhere(params),
      ],
    };

    const narrowing: Prisma.QuoteWhereInput[] = [scope];

    if (search) {
      narrowing.push({
        OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { customerReference: { contains: search, mode: 'insensitive' } },
          { originCode: { contains: search, mode: 'insensitive' } },
          { destinationCode: { contains: search, mode: 'insensitive' } },
          { group: { name: { contains: search, mode: 'insensitive' } } },
          { account: { cw1OrgCode: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    if (params.segment && isPipelineSegment(params.segment)) {
      narrowing.push(pipelineSegmentWhere(params.segment, now));
    }

    if (params.view === 'unclaimed') {
      narrowing.push({ claimedById: null });
    } else if (params.view === 'mine') {
      narrowing.push({ claimedById: actor.userId });
    } else if (params.view === 'expiring') {
      narrowing.push(pipelineSegmentWhere('expiring_soon', now));
    }

    const where: Prisma.QuoteWhereInput = { AND: narrowing };

    return this.repo.runInternal(async (tx) => {
      const [rows, total, pipeline, unclaimed] = await Promise.all([
        tx.quote.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            claimedBy: { select: { displayName: true } },
            group: {
              select: {
                id: true,
                name: true,
                defaultServicingBranch: { select: { name: true, city: true } },
              },
            },
            account: { select: { servicingBranch: { select: { name: true, city: true } } } },
            equipment: { select: { quantity: true, containerType: true, position: true } },
            options: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                isRecommended: true,
                totalMinorUnits: true,
                chargeLines: maySeeMargin
                  ? { select: { quantity: true, cost: { select: { costMinorUnits: true } } } }
                  : false,
              },
            },
          },
        }),
        tx.quote.count({ where }),
        countPipeline((clause) => tx.quote.count({ where: clause }), scope, now),
        tx.quote.count({
          where: {
            AND: [
              scope,
              { claimedById: null },
              // Both pre-offer segments, which is what the single `requested`
              // bucket used to mean. Narrowing this to `submitted` would drop a
              // quote whose claim lapsed while it was already being worked.
              {
                OR: [
                  pipelineSegmentWhere('submitted', now),
                  pipelineSegmentWhere('in_progress', now),
                ],
              },
            ],
          },
        }),
      ]);

      /*
       * "Valencia · 12 quotations" under the customer's name.
       *
       * One grouped count for the whole page rather than one per row: at 25 rows
       * the per-row version is 25 extra round trips for a caption. The mockup
       * says "48 shipments" here; there is no shipment table yet, so the row says
       * what we can actually count. Recorded in docs/gaps.md.
       */
      const groupIds = [...new Set(rows.map((row) => row.group?.id).filter(Boolean))] as string[];
      const perCustomer =
        groupIds.length === 0
          ? []
          : await tx.quote.groupBy({
              by: ['customerGroupId'],
              where: { customerGroupId: { in: groupIds }, status: { not: 'draft' } },
              _count: { _all: true },
            });
      const countFor = new Map(
        perCustomer.map((entry) => [entry.customerGroupId, entry._count._all]),
      );

      return {
        items: rows.map((row) => {
          const branch =
            row.account?.servicingBranch ?? row.group?.defaultServicingBranch ?? null;
          // The headline total mirrors the recommended option (see `price`), so
          // the margin beside it has to come from the same option or the row
          // would show one option's price against another's margin.
          const headline =
            row.options.find((option) => option.isRecommended) ?? row.options[0] ?? null;

          return {
            id: row.id,
            reference: row.reference,
            status: row.status,
            mode: row.mode,
            originCode: row.originCode,
            destinationCode: row.destinationCode,
            customerName: row.group?.name ?? null,
            createdAt: row.createdAt.toISOString(),
            claimedById: row.claimedById,
            claimedAt: row.claimedAt?.toISOString() ?? null,
            claimedByName: row.claimedBy?.displayName ?? null,
            claimedByMe: row.claimedById === actor.userId,
            claimExpiresAt:
              row.claimedAt === null
                ? null
                : new Date(row.claimedAt.getTime() + expiryHours * 3_600_000).toISOString(),

            customerReference: row.customerReference,
            customerBranchName: branch?.city ?? branch?.name ?? null,
            customerQuoteCount: countFor.get(row.customerGroupId) ?? 0,
            cargo: cargoFor({
              loadType: row.loadType,
              grossWeightKg: row.grossWeightKg,
              volumeM3: row.volumeM3,
              payload: row.payload,
              equipment: row.equipment,
            }),
            totalMinorUnits: row.totalMinorUnits === null ? null : Number(row.totalMinorUnits),
            currency: row.currency,
            optionCount: row.options.length,
            validUntil: row.validUntil?.toISOString() ?? null,
            daysRemaining: daysRemaining(row.validUntil, now),
            pipelineSegment: pipelineSegmentFor(row.status, row.validUntil, now),
            ownerInitials: initialsOf(row.claimedBy?.displayName ?? null),
            marginPercent: maySeeMargin ? marginOf(headline) : null,
          };
        }),
        total,
        pipeline,
        unclaimed,
        maySeeMargin,
      };
    });
  }

  /**
   * The same branch rule the queue applies, enforced on a single quote.
   *
   * Without this the scope was a filter on a list rather than an access rule: a
   * specialist in another branch never saw the quote in their queue, and reached it
   * anyway by putting its id in the URL. Every route that acts on one quote calls this.
   *
   * It answers 404, not 403. A pricer in Madrid should not learn that a Valencia quote
   * exists, and 403 would tell them.
   */
  private async assertInBranch(tx: TenantClient, quoteId: string): Promise<void> {
    const actor = this.require();

    if (actor.permissions.has(PERMISSIONS.PRICING_CROSS_BRANCH)) {
      return;
    }

    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      select: {
        account: { select: { servicingBranch: { select: { code: true } } } },
        group: { select: { defaultServicingBranch: { select: { code: true } } } },
      },
    });

    if (!quote) {
      throw new NotFoundException({
        message: 'Quote not found.',
        details: { code: 'QUOTE_NOT_FOUND' },
      });
    }

    // Same resolution as the queue: the account's servicing branch, falling back to the
    // customer's default when the request named no account.
    const servicing =
      quote.account?.servicingBranch?.code ?? quote.group?.defaultServicingBranch?.code ?? null;
    const actorBranch = actor.branchCode ?? '';

    // `servicing === null` is deliberately allowed through, matching the queue: an
    // unrouted request is claimable by whoever finds it. Seeing it in the queue and
    // then being refused the claim would be the worst of both.
    if (actorBranch === '' || (servicing !== null && servicing !== actorBranch)) {
      throw new NotFoundException({
        message: 'Quote not found.',
        details: { code: 'QUOTE_NOT_FOUND' },
      });
    }
  }

  /**
   * Takes ownership of a request.
   *
   * ONE conditional UPDATE, and the row count is the answer. Reading the quote first
   * and then writing it would leave a window in which two specialists both see it
   * unclaimed and both succeed - which is the precise thing a claim exists to prevent,
   * and it would show up as two people quoting the same job rather than as an error.
   *
   * An expired claim is taken in the same statement, so a forgotten claim frees itself
   * with no sweeper job and no administrator.
   */
  async claim(id: string): Promise<{ claimedAt: string; claimExpiresAt: string }> {
    const actor = this.require();
    const expiryHours = await this.claimExpiryHours();
    const now = new Date();
    const staleBefore = new Date(now.getTime() - expiryHours * 3_600_000);

    return this.repo.runInternal(async (tx) => {
      await this.assertInBranch(tx, id);

      const result = await tx.quote.updateMany({
        where: {
          id,
          OR: [
            { status: 'requested' },
            // Already mine: re-claiming is a no-op that refreshes the clock, not a 409.
            { status: 'claimed', claimedById: actor.userId },
            // Somebody else's, but they have had their time.
            { status: 'claimed', claimedAt: { lt: staleBefore } },
          ],
        },
        data: { status: 'claimed', claimedById: actor.userId, claimedAt: now },
      });

      if (result.count === 0) {
        await this.explainClaimFailure(tx, id);
      }

      await this.audit(tx, id, 'quote.claimed', { expiryHours });

      return {
        claimedAt: now.toISOString(),
        claimExpiresAt: new Date(now.getTime() + expiryHours * 3_600_000).toISOString(),
      };
    });
  }

  /** Gives it back to the queue. The holder only - taking someone else's is a force-release. */
  async release(id: string): Promise<void> {
    const actor = this.require();

    await this.repo.runInternal(async (tx) => {
      await this.assertInBranch(tx, id);
      const result = await tx.quote.updateMany({
        where: { id, status: 'claimed', claimedById: actor.userId },
        data: { status: 'requested', claimedById: null, claimedAt: null },
      });

      if (result.count === 0) {
        await this.explainReleaseFailure(tx, id, actor.userId);
      }

      await this.audit(tx, id, 'quote.claim.released', {});
    });
  }

  /**
   * Takes a claim off somebody else.
   *
   * Two gates, not one: the `pricing.claim.release` permission says this person may do
   * it at all, and the `releaseBy` setting says which kind of person the business wants
   * doing it here. The reason is mandatory and recorded, because the banner on the staff
   * screen promises the customer's specialist that a force-release is accountable.
   */
  async forceRelease(id: string, reason: string): Promise<void> {
    const actor = this.require();
    const trimmed = reason.trim();

    if (trimmed.length === 0) {
      throw new ForbiddenException('A force-release needs a reason.');
    }

    const releaseBy = await this.settings.get(
      'quotations.releaseBy',
      this.settings.scopeOf(actor),
    );

    const required =
      releaseBy === 'admin' ? PERMISSIONS.ADMIN_SETTINGS_MANAGE : PERMISSIONS.PRICING_APPROVE;

    if (!actor.permissions.has(required)) {
      throw new ForbiddenException(
        releaseBy === 'admin'
          ? 'Only administrators can release another user\u2019s claim here.'
          : 'Only pricing approvers can release another user\u2019s claim here.',
      );
    }

    await this.repo.runInternal(async (tx) => {
      await this.assertInBranch(tx, id);
      const quote = await tx.quote.findUnique({
        where: { id },
        select: { claimedById: true, status: true },
      });

      if (quote === null) {
        throw new NotFoundException('Quote not found.');
      }

      if (quote.claimedById === null) {
        throw new ConflictException('That request is not claimed.');
      }

      // Only an in-progress claim may be taken. `price()` sets `claimedById`, so without
      // this a force-release on a priced or approved quote dropped it back into the open
      // queue with its options still attached - and the machine forbids that move anyway.
      if (quote.status !== 'claimed') {
        throw new ConflictException({
          message: `A quote with status ${quote.status} cannot be force-released.`,
          details: { code: 'QUOTE_NOT_CLAIMED', status: quote.status },
        });
      }

      assertTransition(quote.status as QuoteStatus, 'requested');

      const released = await tx.quote.updateMany({
        where: { id, status: 'claimed', claimedById: quote.claimedById },
        data: { status: 'requested', claimedById: null, claimedAt: null },
      });

      if (released.count === 0) {
        throw new ConflictException('That claim changed while you were releasing it.');
      }

      await this.audit(tx, id, 'quote.claim.force_released', {
        reason: trimmed,
        previousHolderId: quote.claimedById,
        releaseBy,
      });

      this.logger.warn(
        `Claim on quote ${id} force-released by ${actor.userId}, previously held by ${quote.claimedById}.`,
      );
    });
  }

  /**
   * Everything the pricing screen needs for one request, in one call.
   *
   * The resolved settings travel WITH the quote rather than being fetched
   * separately, because two round trips can disagree: a screen that learned the
   * rules for Valencia and then priced a Madrid request would offer cost capture
   * the API is about to refuse.
   */
  async detail(id: string): Promise<PricingQuoteDto> {
    const built = await this.loadDetail(id);

    // Reference data is read after the transaction closes: it is platform data,
    // identical for every quote in this mode, and has no business holding a
    // transaction open while it is fetched.
    const [bases, carriers, codes, currencies] = await Promise.all([
      this.reference
        .items(REFERENCE_CATEGORIES.CHARGE_BASIS)
        .then((items) => items.map((item) => item.label)),
      this.reference
        .items(REFERENCE_CATEGORIES.CARRIER, { mode: built.mode })
        .then((items) => items.map((item) => item.label)),
      // Code AND label, unlike the two above: the pricer stores FRT and needs to
      // read "Ocean or air freight" to know it is the right one.
      this.reference.items(REFERENCE_CATEGORIES.CHARGE_CODE),
      this.reference.items(REFERENCE_CATEGORIES.CURRENCY),
    ]);

    return {
      ...built,
      chargeBases: bases,
      carrierOptions: carriers,
      chargeCodes: codes,
      currencyOptions: currencies,
    };
  }

  /**
   * The pricing assistant, behind this service's own branch and claim rules.
   *
   * It runs here rather than on a route of its own so a quote the pricer could not
   * open is a quote the assistant cannot read either - `detail` already refuses
   * another branch's work, and repeating that check somewhere else is how the two
   * eventually disagree.
   *
   * What reaches the model is built here and is deliberately narrow: no cost, no
   * margin, no internal remark, whatever this branch's cost settings allow.
   */
  async assist(id: string, input: AssistInput, locale?: string): Promise<PricingAssistDto> {
    if (!this.assistant) {
      throw new ServiceUnavailableException('The pricing assistant is not available.');
    }

    const quote = await this.detail(id);

    await this.analytics.record({
      action: 'pricing.assist.used',
      entityType: 'quote',
      entityId: id,
      metadata: { want: input.want },
    });

    return this.assistant.assist(
      {
        reference: quote.reference,
        mode: quote.mode,
        loadType: quote.loadType,
        originCode: quote.originCode,
        destinationCode: quote.destinationCode,
        originName: quote.originName,
        destinationName: quote.destinationName,
        incoterm: quote.incoterm,
        readyDate: quote.readyDate,
        currency: quote.currency,
        customerName: quote.customerName,
        grossWeightKg: quote.grossWeightKg,
        volumeM3: quote.volumeM3,
        chargeableKg: quote.chargeableKg,
        containerCount: quote.equipment.reduce((sum, unit) => sum + unit.quantity, 0),
        equipmentSummary: quote.equipment
          .map((unit) => `${unit.quantity} x ${unit.containerType}`)
          .join(', '),
        hasDangerousGoods: quote.dangerousGoods.length > 0,
        dangerousGoodsSummary: quote.dangerousGoods
          .map((entry) => [entry.unNumber, entry.hazardClass].filter(Boolean).join(' class '))
          .join('; '),
        hasTemperatureControl: quote.temperatureControl !== null,
        temperatureSummary: quote.temperatureControl
          ? `set point ${quote.temperatureControl.setPointCelsius} C`
          : '',
        hasOversize: quote.oversizeItems.length > 0,
        notes: quote.notes,
        defaultValidityDays: quote.defaultValidityDays,
        carrierOptions: quote.carrierOptions,
      },
      input,
      locale,
    );
  }

  private async loadDetail(
    id: string,
  ): Promise<
    Omit<PricingQuoteDto, 'chargeBases' | 'carrierOptions' | 'chargeCodes' | 'currencyOptions'>
  > {
    const actor = this.require();
    const scope = this.settings.scopeOf(actor);

    const [costCapture, disclose, validity, approval, threshold, pubMode, expiryHours] =
      await Promise.all([
        this.settings.get('quotations.costCapture', scope),
        this.settings.get('quotations.disclose', scope),
        this.settings.get('quotations.validity', scope),
        this.settings.get('quotations.approval', scope),
        this.settings.get('quotations.threshold', scope),
        this.settings.get('quotations.pubMode', scope),
        this.settings.get('quotations.claimExpiry', scope),
      ]);

    const maySeeCost = costCapture && actor.permissions.has(PERMISSIONS.PRICING_COST_VIEW);

    return this.repo.runInternal(async (tx) => {
      await this.assertInBranch(tx, id);
      const quote = await tx.quote.findUnique({
        where: { id },
        include: {
          group: { select: { name: true } },
          // The account the request was raised against, and its CargoWise code.
          // Both belong on the "as submitted" drawer: a pricer looking at a group
          // with six offices needs to know which one asked.
          account: { select: { name: true, cw1OrgCode: true } },
          claimedBy: { select: { displayName: true } },
          pricedBy: { select: { displayName: true } },
          approvedBy: { select: { displayName: true } },
          options: {
            orderBy: { position: 'asc' },
            include: {
              chargeLines: {
                orderBy: { position: 'asc' },
                // Cost is a separate table with an internal-only policy. Including it
                // only when permitted means the figure is never fetched, let alone
                // serialised, for somebody who may not see it.
                include: maySeeCost ? { cost: true } : undefined,
              },
            },
          },
          // The pricer cannot price hazardous cargo without seeing the hazard.
          dangerousGoods: { orderBy: { position: 'asc' } },
          // A per-container charge multiplies by this.
          equipment: { orderBy: { position: 'asc' } },
          // A reefer is priced differently, and a heavy lift is priced per piece.
          temperatureControl: true,
          oversizeItems: { orderBy: { position: 'asc' } },
        },
      });

      if (quote === null) {
        throw new NotFoundException('Quote not found.');
      }

      // The two port names, in one statement. A pricer reads Qingdao faster than
      // CNTAO, and the lane is the first thing they look at; an unknown code
      // simply has no name, which is why this never fails the request.
      const places = await tx.port.findMany({
        where: { code: { in: [quote.originCode, quote.destinationCode] } },
        select: { code: true, name: true },
      });
      const placeName = (code: string) => places.find((port) => port.code === code)?.name ?? null;

      // Looked up rather than joined: `created_by_id` carries no Prisma relation,
      // and a customer user who has since been removed simply has no name - which
      // is why this never fails the request.
      const requestedBy =
        quote.createdById === null
          ? null
          : await tx.user.findUnique({
              where: { id: quote.createdById },
              select: { displayName: true },
            });

      const options = quote.options.map((option) => {
        const lines = option.chargeLines.map((line) => ({
          id: line.id,
          position: line.position,
          code: line.code,
          description: line.description,
          basis: line.basis,
          quantity: Number(line.quantity),
          rateMinorUnits: Number(line.rateMinorUnits),
          currency: line.currency,
          amountMinorUnits: Number(line.amountMinorUnits),
          // Null means "never costed", zero means "costed at zero". Collapsing the two
          // understated the option cost, overstated the margin, and - because the editor
          // renders a zero as "0.00" and posts it back - fabricated a cost row on the
          // next save.
          costMinorUnits: (() => {
            if (!maySeeCost) return null;
            const cost = (line as { cost?: { costMinorUnits: bigint } | null }).cost;
            return cost ? Number(cost.costMinorUnits) : null;
          })(),
        }));

        const sell = Number(option.totalMinorUnits ?? 0);
        const anyCostRecorded =
          maySeeCost &&
          option.chargeLines.some(
            (line) => (line as { cost?: unknown }).cost !== null && (line as { cost?: unknown }).cost !== undefined,
          );
        // Cost is a RATE, like `rateMinorUnits` beside it in the grid - a pricer
        // typing 320.00 against two containers means per container. So the option
        // cost is the sum of quantity x cost, not the sum of the costs.
        const cost = anyCostRecorded
          ? lines.reduce(
              (sum, line) =>
                sum + Math.trunc((Math.round(line.quantity * 1000) * (line.costMinorUnits ?? 0)) / 1000),
              0,
            )
          : null;

        return {
          id: option.id,
          position: option.position,
          name: option.name,
          carrierName: option.carrierName,
          serviceRouting: option.serviceRouting,
          transitDaysMin: option.transitDaysMin,
          transitDaysMax: option.transitDaysMax,
          nextDepartures: option.nextDepartures,
          freeTimeDays: option.freeTimeDays,
          totalMinorUnits: option.totalMinorUnits === null ? null : Number(option.totalMinorUnits),
          currency: option.currency,
          validUntil: option.validUntil?.toISOString() ?? null,
          isRecommended: option.isRecommended,
          notes: option.notes,
          termsIncluded: option.termsIncluded,
          termsExcluded: option.termsExcluded,
          termsPayment: option.termsPayment,
          termsSubjectTo: option.termsSubjectTo,
          chargeLines: lines,
          costTotalMinorUnits: cost,
          // Derived here, never stored. A saved copy of a subtraction is a second
          // source of truth waiting to disagree with the two numbers above it.
          marginPercent: cost === null || sell === 0 ? null : Math.round(((sell - cost) / sell) * 1000) / 10,
        };
      });

      return {
        id: quote.id,
        reference: quote.reference,
        status: quote.status,
        version: quote.version,
        mode: quote.mode,
        originCode: quote.originCode,
        destinationCode: quote.destinationCode,
        loadType: quote.loadType,
        originName: placeName(quote.originCode),
        destinationName: placeName(quote.destinationCode),
        incoterm: quote.incoterm,
        readyDate: quote.readyDate?.toISOString() ?? null,
        customerReference: quote.customerReference,
        serviceLevel: quote.serviceLevel,
        // Nullable in the schema, because the column predates the field being asked
        // for. A quote with none is quoted in the platform default rather than in
        // nothing, which is what the option editor assumed before it was carried here.
        currency: quote.currency ?? 'EUR',
        customerName: quote.group?.name ?? null,
        accountName: quote.account?.name ?? null,
        cw1OrgCode: quote.account?.cw1OrgCode ?? null,
        requestedByName: requestedBy?.displayName ?? null,
        grossWeightKg: quote.grossWeightKg === null ? null : Number(quote.grossWeightKg),
        volumeM3: quote.volumeM3 === null ? null : Number(quote.volumeM3),
        chargeableKg: quote.chargeableKg === null ? null : Number(quote.chargeableKg),
        notes: quote.notes,
        messageToCustomer: quote.messageToCustomer,
        payload: quote.payload,
        dangerousGoods: dangerousGoodsFor(quote.dangerousGoods),
        equipment: equipmentFor(quote.equipment),
        temperatureControl: temperatureControlFor(quote.temperatureControl),
        oversizeItems: oversizeItemsFor(quote.oversizeItems),
        claimedById: quote.claimedById,
        claimedByName: quote.claimedBy?.displayName ?? null,
        claimedAt: quote.claimedAt?.toISOString() ?? null,
        claimExpiresAt:
          quote.claimedAt === null
            ? null
            : new Date(quote.claimedAt.getTime() + expiryHours * 3_600_000).toISOString(),
        claimedByMe: quote.claimedById === actor.userId,
        pricedByName: quote.pricedBy?.displayName ?? null,
        pricedById: quote.pricedById,
        pricedByMe: quote.pricedById === actor.userId,
        approvedByName: quote.approvedBy?.displayName ?? null,
        approvedAt: quote.approvedAt?.toISOString() ?? null,
        publishedAt: quote.publishedAt?.toISOString() ?? null,
        options,
        createdAt: quote.createdAt.toISOString(),
        canRecordCost: maySeeCost,
        disclosesCarrier: disclose,
        defaultValidityDays: validity,
        approvalRequired: approval,
        // Minor units, so the screen never multiplies by 100 itself.
        approvalThresholdMinorUnits: Math.round(threshold * 100),
        publicationMode: pubMode,
      };
    });
  }

  /**
   * Records a price. The whole of C4.
   *
   * Replaces the option set outright rather than merging: a pricer who removes a line
   * expects it gone, and a merge would leave orphans from the previous attempt sitting
   * in the customer's PDF. The previous set goes to the audit record first, so
   * "replaced" never means "lost".
   *
   * Re-pricing an already-PUBLISHED quote bumps the version the customer sees, because
   * they were looking at the old one. Re-pricing anything else edits version 1 in place -
   * nobody outside has seen it, so there is nothing to supersede.
   */
  async price(quoteId: string, body: unknown): Promise<{ status: string; version: number }> {
    const actor = this.require();
    const parsed = priceQuoteSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const input = parsed.data;

    // Refused, not truncated. Silently dropping the second option would publish a
    // cheaper answer than the pricer typed, which is worse than an error.
    if (input.options.length > 1 && !(await this.switches.isEnabled('quotations.multi_option'))) {
      throw new BadRequestException({
        message: 'This quote may carry only one option.',
        details: { code: 'MULTI_OPTION_UNAVAILABLE', submitted: input.options.length },
      });
    }

    const costCapture = await this.settings.get(
      'quotations.costCapture',
      this.settings.scopeOf(actor),
    );
    const mayRecordCost = costCapture && actor.permissions.has(PERMISSIONS.PRICING_COST_VIEW);
    const costsOffered = input.options.some((option) =>
      option.chargeLines.some((line) => line.costMinorUnits !== undefined),
    );

    // Refused, not silently dropped. A pricer who typed cost into a branch that does
    // not capture it needs to know the number went nowhere - discovering it later, on a
    // margin report that is quietly empty, is far more expensive.
    if (costsOffered && !mayRecordCost) {
      throw new ForbiddenException(
        costCapture
          ? 'Recording cost needs the pricing.cost.view permission.'
          : 'Cost capture is switched off for this branch.',
      );
    }

    return this.repo.runInternal(async (tx) => {
      await this.assertInBranch(tx, quoteId);
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        select: { status: true, version: true, claimedById: true, customerGroupId: true },
      });

      if (quote === null) {
        throw new NotFoundException('Quote not found.');
      }

      if (!PRICEABLE_FROM.includes(quote.status as (typeof PRICEABLE_FROM)[number])) {
        throw new ConflictException(`A quote with status ${quote.status} cannot be priced.`);
      }

      if (quote.claimedById !== null && quote.claimedById !== actor.userId) {
        throw new ConflictException('That request is claimed by somebody else.');
      }

      await this.archivePreviousOptions(tx, quoteId, actor.userId, quote.customerGroupId);
      // Cascades to charge lines and their costs.
      await tx.quoteOption.deleteMany({ where: { quoteId } });

      const recommended = await this.writeOptions(tx, quoteId, input, mayRecordCost, actor.userId);

      // Only a published quote has been seen, so only a published quote supersedes.
      const version = quote.status === 'published' ? quote.version + 1 : quote.version;

      assertTransition(quote.status as QuoteStatus, 'priced');

      const repriced = await tx.quote.updateMany({
        where: { id: quoteId, status: quote.status, version: quote.version },
        data: {
          status: 'priced',
          version,
          pricedById: actor.userId,
          pricedAt: new Date(),
          // Pricing an unclaimed quote claims it. One click, not two.
          claimedById: actor.userId,
          claimedAt: quote.claimedById === null ? new Date() : undefined,
          // The pricer's words, in their own column. `notes` is the customer's.
          messageToCustomer: input.messageToCustomer ?? undefined,
          // Headline figures mirror the recommended option, written by this method
          // and no other, so the quote and its option cannot drift apart.
          totalMinorUnits: recommended?.totalMinorUnits ?? null,
          currency: recommended?.currency ?? null,
          validUntil: recommended?.validUntil ?? null,
        },
      });

      if (repriced.count === 0) {
        throw new ConflictException(CONCURRENT_CHANGE);
      }

      await this.audit(tx, quoteId, 'quote.priced', {
        optionCount: input.options.length,
        version,
        costRecorded: mayRecordCost && costsOffered,
      });

      return { status: 'priced', version };
    });
  }

  /**
   * Writes the options and returns the one whose figures the quote should mirror.
   *
   * Falls back to the first option when nobody marked a recommendation, because a quote
   * with no headline total reads to the customer as "no price" - which is worse than
   * showing them the first of several a person deliberately typed.
   */
  private async writeOptions(
    tx: TenantClient,
    quoteId: string,
    input: PriceQuoteInput,
    mayRecordCost: boolean,
    userId: string,
  ): Promise<{ totalMinorUnits: bigint; currency: string | null; validUntil: Date | null } | null> {
    let headline: {
      totalMinorUnits: bigint;
      currency: string | null;
      validUntil: Date | null;
    } | null = null;

    for (const [index, option] of input.options.entries()) {
      // Arithmetic belongs here, not in the browser. The figure on the screen and the
      // figure on the PDF come out of the same statement.
      //
      // Done in BigInt, not floats: quantity carries three decimals and rates are in
      // minor units, so `quantity * rate` in JavaScript can exceed Number.MAX_SAFE_INTEGER
      // and start rounding a price silently. Scaling the quantity by 1000 first keeps the
      // whole multiplication exact.
      const lines = option.chargeLines.map((line, position) => {
        const scaledQuantity = BigInt(Math.round(line.quantity * 1000));
        const amount = (scaledQuantity * BigInt(line.rateMinorUnits)) / 1000n;

        return {
          position,
          code: line.code ?? null,
          description: line.description,
          basis: line.basis ?? null,
          quantity: line.quantity,
          rateMinorUnits: BigInt(line.rateMinorUnits),
          currency: line.currency,
          amountMinorUnits: amount,
        };
      });

      const total = lines.reduce((sum, line) => sum + line.amountMinorUnits, 0n);
      const currency = lines[0]?.currency ?? null;

      const created = await tx.quoteOption.create({
        data: {
          quoteId,
          position: index,
          name: option.name ?? null,
          carrierName: option.carrierName ?? null,
          serviceRouting: option.serviceRouting ?? null,
          transitDaysMin: option.transitDaysMin ?? null,
          transitDaysMax: option.transitDaysMax ?? null,
          nextDepartures: option.nextDepartures ?? null,
          freeTimeDays: option.freeTimeDays ?? null,
          totalMinorUnits: total,
          currency,
          validUntil: option.validUntil ?? null,
          isRecommended: option.isRecommended,
          notes: option.notes ?? null,
          termsIncluded: option.termsIncluded ?? null,
          termsExcluded: option.termsExcluded ?? null,
          termsPayment: option.termsPayment ?? null,
          termsSubjectTo: option.termsSubjectTo ?? null,
          chargeLines: { create: lines },
        },
        include: { chargeLines: { orderBy: { position: 'asc' } } },
      });

      if (mayRecordCost) {
        for (const [position, line] of option.chargeLines.entries()) {
          if (line.costMinorUnits === undefined) {
            continue;
          }

          await tx.quoteChargeLineCost.create({
            data: {
              quoteChargeLineId: created.chargeLines[position]!.id,
              costMinorUnits: BigInt(line.costMinorUnits),
              currency: line.currency,
              recordedById: userId,
            },
          });
        }
      }

      if (option.isRecommended || headline === null) {
        headline = {
          totalMinorUnits: total,
          currency,
          validUntil: option.validUntil ?? null,
        };
      }
    }

    return headline;
  }

  /**
   * Keeps the outgoing option set in the audit trail before it is replaced.
   *
   * Cost is deliberately NOT archived. It would put internal figures into a row that
   * `admin.audit.read` can reach, which is a wider audience than `pricing.cost.view`,
   * and an audit record is the last place a permission boundary should quietly widen.
   */
  private async archivePreviousOptions(
    tx: TenantClient,
    quoteId: string,
    userId: string,
    customerGroupId: string,
  ): Promise<void> {
    const previous = await tx.quoteOption.findMany({
      where: { quoteId },
      orderBy: { position: 'asc' },
      include: { chargeLines: { orderBy: { position: 'asc' } } },
    });

    if (previous.length === 0) {
      return;
    }

    await tx.auditEvent.create({
      data: {
        customerGroupId,
        actorUserId: userId,
        action: 'quote.options.replaced',
        entityType: 'quote',
        entityId: quoteId,
        metadata: {
          options: previous.map((option) => ({
            position: option.position,
            name: option.name,
            carrierName: option.carrierName,
            totalMinorUnits: option.totalMinorUnits?.toString() ?? null,
            currency: option.currency,
            isRecommended: option.isRecommended,
            chargeLines: option.chargeLines.map((line) => ({
              code: line.code,
              description: line.description,
              amountMinorUnits: line.amountMinorUnits.toString(),
            })),
          })),
        } as never,
      },
    });
  }

  /**
   * Approves a priced quote. C8.
   *
   * The approver may never be the pricer. This is not a permission that can be
   * granted around - the Approvals screen says so on its face, and a platform that
   * let one person do both would be offering a four-eyes control it does not have.
   */
  async approve(quoteId: string): Promise<{ status: string }> {
    const actor = this.require();

    return this.repo.runInternal(async (tx) => {
      await this.assertInBranch(tx, quoteId);
      const quote = await this.loadForDecision(tx, quoteId);

      if (quote.status !== 'priced') {
        throw new ConflictException(`A quote with status ${quote.status} cannot be approved.`);
      }

      if (quote.pricedById === actor.userId) {
        throw new ForbiddenException('You cannot approve your own pricing.');
      }

      assertTransition(quote.status as QuoteStatus, 'approved');

      const approved = await tx.quote.updateMany({
        where: { id: quoteId, status: quote.status, version: quote.version },
        data: { status: 'approved', approvedById: actor.userId, approvedAt: new Date() },
      });

      if (approved.count === 0) {
        throw new ConflictException(CONCURRENT_CHANGE);
      }

      await this.audit(tx, quoteId, 'quote.approved', { pricedById: quote.pricedById });
      await this.analytics.recordIn(tx, {
        action: 'quote.approved',
        entityType: 'quote',
        entityId: quoteId,
        customerGroupId: quote.customerGroupId,
      });

      return { status: 'approved' };
    });
  }

  /**
   * Sends a priced quote back for rework, with a mandatory reason.
   *
   * The reason is the whole value of the step. "Rejected" with no explanation
   * means the pricer guesses, re-submits, and the approver rejects it again.
   */
  async sendBack(quoteId: string, reason: string): Promise<{ status: string }> {
    const actor = this.require();
    const trimmed = reason.trim();

    if (trimmed.length < 3) {
      throw new BadRequestException('Sending a quote back needs a reason.');
    }

    return this.repo.runInternal(async (tx) => {
      await this.assertInBranch(tx, quoteId);
      const quote = await this.loadForDecision(tx, quoteId);

      if (quote.status !== 'priced' && quote.status !== 'approved') {
        throw new ConflictException(`A quote with status ${quote.status} cannot be sent back.`);
      }

      if (quote.pricedById === actor.userId) {
        throw new ForbiddenException('You cannot send your own pricing back.');
      }

      assertTransition(quote.status as QuoteStatus, 'priced');

      const sentBack = await tx.quote.updateMany({
        where: { id: quoteId, status: quote.status, version: quote.version },
        data: {
          status: 'priced',
          approvedById: null,
          approvedAt: null,
          // Returned to whoever priced it, so it lands in their work rather than
          // back in the open queue where anybody might pick up a half-argued job.
          claimedById: quote.pricedById,
          claimedAt: quote.pricedById === null ? null : new Date(),
        },
      });

      if (sentBack.count === 0) {
        throw new ConflictException(CONCURRENT_CHANGE);
      }

      await this.audit(tx, quoteId, 'quote.sent_back', { reason: trimmed, to: quote.pricedById });

      return { status: 'priced' };
    });
  }

  /**
   * Releases a priced quote to the customer. C5.
   *
   * One transaction: the status, the released claim, the customer notification and
   * the CargoWise copy all land together or none of them do. A published quote with
   * no notification is a customer who is never told, and that is indistinguishable
   * from not having published at all.
   *
   * It does NOT send anything inline. The notification is a job; the CargoWise copy
   * is a pending row. Publishing must not be able to fail because a mail server is
   * slow, and a customer must not wait on CargoWise to see a price a person typed.
   */
  async publish(quoteId: string): Promise<{ status: string; publishedAt: string }> {
    const actor = this.require();
    const scope = this.settings.scopeOf(actor);

    const [approvalRequired, threshold, pubMode] = await Promise.all([
      this.settings.get('quotations.approval', scope),
      this.settings.get('quotations.threshold', scope),
      this.settings.get('quotations.pubMode', scope),
    ]);

    return this.repo.runInternal(async (tx) => {
      await this.assertInBranch(tx, quoteId);
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        select: {
          status: true,
          version: true,
          customerGroupId: true,
          reference: true,
          pricedById: true,
          approvedById: true,
          currency: true,
          totalMinorUnits: true,
          options: {
            // Ordered, so "the first option" when none is recommended is the same
            // option the headline figures were taken from rather than whatever the
            // planner happened to return.
            orderBy: { position: 'asc' },
            select: {
              totalMinorUnits: true,
              currency: true,
              validUntil: true,
              isRecommended: true,
              _count: { select: { chargeLines: true } },
            },
          },
        },
      });

      if (quote === null) {
        throw new NotFoundException('Quote not found.');
      }

      if (quote.status !== 'priced' && quote.status !== 'approved') {
        throw new ConflictException(`A quote with status ${quote.status} cannot be published.`);
      }

      // An answer of some kind. A charge line that exists but sums to nothing is not
      // an answer either: `rateMinorUnits` defaults to zero for a blank box, so
      // counting lines alone would have let a quote be published at 0.00 and accepted.
      //
      // A customer-visible document counts as a complete answer on its own. Some
      // branches quote in their own template and have no amount to type, and
      // refusing them would be the portal imposing a format the business does not
      // have. A document the customer cannot see does not count - it would publish
      // an answer they can never read.
      const hasAmount = quote.options.some(
        (option) => (option.totalMinorUnits ?? 0n) !== 0n,
      );

      const visibleDocuments = await tx.quoteDocument.count({
        where: { quoteId, direction: 'to_customer', customerVisible: true },
      });

      if (!hasAmount && visibleDocuments === 0) {
        throw new ConflictException(
          'There is nothing to publish: enter an amount on at least one option, or attach a document.',
        );
      }

      // Publishing something that has already expired helps nobody, and the customer
      // would open it to find they cannot accept.
      const recommended = quote.options.find((option) => option.isRecommended) ?? quote.options[0];
      const validUntil = recommended?.validUntil ?? null;

      if (validUntil !== null && validUntil.getTime() < Date.now()) {
        throw new ConflictException('That quote has already passed its validity date.');
      }

      // The threshold setting carries a number, not a currency, so it can only be
      // compared against options quoted in the settlement currency. A USD option and a
      // JPY option compared as bare integers would demand four eyes on a small quote or
      // miss it on a large one - both are wrong, and the second is the dangerous one.
      const thresholdCurrency = THRESHOLD_CURRENCY;
      const comparable = quote.options.filter(
        (option) => (option.currency ?? thresholdCurrency) === thresholdCurrency,
      );
      const skipped = quote.options.length - comparable.length;

      const highest = comparable.reduce(
        (max, option) => (option.totalMinorUnits ?? 0n) > max ? (option.totalMinorUnits ?? 0n) : max,
        0n,
      );
      const needsApproval =
        approvalRequired &&
        // An option we cannot measure demands the second pair of eyes rather than
        // waiving it. A control that fails open is not a control.
        (skipped > 0 || highest > BigInt(Math.round(threshold * 100)));

      if (skipped > 0) {
        // Not silent. An option we could not measure is exactly the one a reviewer
        // would want to know about, and it now forces approval rather than skipping it.
        this.logger.warn(
          `Quote ${quoteId}: ${skipped} option(s) not in ${thresholdCurrency} could not be measured against the approval threshold; approval is required.`,
        );
      }

      if (needsApproval && quote.status !== 'approved') {
        throw new ConflictException(
          'This quote is above the approval threshold and needs a second person to approve it first.',
        );
      }

      const publishedAt = new Date();

      assertTransition(quote.status as QuoteStatus, 'published');

      const published = await tx.quote.updateMany({
        where: { id: quoteId, status: quote.status, version: quote.version },
        data: {
          status: 'published',
          publishedById: actor.userId,
          publishedAt,
          // The work is done, so the claim is released rather than left holding a
          // row nobody is working on.
          claimedById: null,
          claimedAt: null,
        },
      });

      if (published.count === 0) {
        throw new ConflictException(CONCURRENT_CHANGE);
      }

      // Queued, never sent here. Enqueued in the same transaction as the status
      // change, so a rollback takes the notification with it. The identity keys on
      // the version, so re-publishing the same version cannot notify twice while a
      // genuine re-price does.
      await this.jobs.enqueue(
        tx,
        JOB_NAMES.QUOTE_PUBLISHED_NOTIFY,
        { quoteId, customerGroupId: quote.customerGroupId },
        { sourceMessageId: `publish:${quoteId}:v${quote.version}`, portalRef: quote.reference },
      );

      // The CargoWise copy. Pending, and publishing does not wait for it: with
      // pubMode 'direct' the customer already has the price, and with 'cw1' the
      // business confirmation happens before anyone reaches this method.
      await this.messages.recordOutbound(tx, {
        operation: INTEGRATION_OPERATIONS.QUOTE_PRICED_SUBMIT,
        portalRef: quote.reference,
        idempotencyKey: `${quote.reference}:v${quote.version}:published`,
        payload: { reference: quote.reference, version: quote.version, publicationMode: pubMode },
        customerGroupId: quote.customerGroupId,
      });

      await this.audit(tx, quoteId, 'quote.published', {
        version: quote.version,
        publicationMode: pubMode,
        approvalRequired: needsApproval,
      });
      await this.analytics.recordIn(tx, {
        action: 'quote.published',
        entityType: 'quote',
        entityId: quoteId,
        customerGroupId: quote.customerGroupId,
        metadata: { optionCount: quote.options.length, version: quote.version },
      });

      return { status: 'published', publishedAt: publishedAt.toISOString() };
    });
  }

  private async loadForDecision(tx: TenantClient, quoteId: string) {
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      // `version` is read so the conditional update below can pin it: approving or
      // sending back an option set that changed underneath is the same defect class
      // as accepting a superseded price.
      select: { status: true, version: true, pricedById: true, customerGroupId: true },
    });

    if (quote === null) {
      throw new NotFoundException('Quote not found.');
    }

    return quote;
  }

  /**
   * Resolved per branch, so one region can run a four-hour clock and another a day.
   * Read once per call rather than cached on the instance: a claim taken seconds after
   * an administrator shortened the expiry must use the new value.
   */
  private async claimExpiryHours(): Promise<number> {
    const actor = this.require();
    return this.settings.get('quotations.claimExpiry', this.settings.scopeOf(actor));
  }

  /**
   * Turns a zero row count into an answer. Only reached on the failure path, so the
   * extra read costs nothing in the common case - and a 409 that names the holder is
   * the difference between a specialist walking to a colleague's desk and filing a
   * support ticket.
   */
  private async explainClaimFailure(tx: TenantClient, id: string): Promise<never> {
    const quote = await tx.quote.findUnique({
      where: { id },
      select: { status: true, claimedAt: true, claimedBy: { select: { displayName: true } } },
    });

    if (quote === null) {
      throw new NotFoundException('Quote not found.');
    }

    if (quote.claimedBy !== null) {
      throw new ConflictException(
        `Already claimed by ${quote.claimedBy.displayName}. Ask them to release it, or have an approver force-release it.`,
      );
    }

    throw new ConflictException(`A quote with status ${quote.status} cannot be claimed.`);
  }

  private async explainReleaseFailure(
    tx: TenantClient,
    id: string,
    userId: string,
  ): Promise<never> {
    const quote = await tx.quote.findUnique({
      where: { id },
      select: { status: true, claimedById: true, claimedBy: { select: { displayName: true } } },
    });

    if (quote === null) {
      throw new NotFoundException('Quote not found.');
    }

    if (quote.claimedById === null) {
      throw new ConflictException('That request is not claimed.');
    }

    if (quote.claimedById !== userId) {
      throw new ConflictException(
        `That request is claimed by ${quote.claimedBy?.displayName ?? 'another user'}.`,
      );
    }

    throw new ConflictException(`A quote with status ${quote.status} cannot be released.`);
  }

  private async audit(
    tx: TenantClient,
    quoteId: string,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const actor = this.require();
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      select: { customerGroupId: true },
    });

    await tx.auditEvent.create({
      data: {
        customerGroupId: quote?.customerGroupId ?? null,
        actorUserId: actor.userId,
        action,
        entityType: 'quote',
        entityId: quoteId,
        metadata: metadata as never,
      },
    });
  }

  private require() {
    const actor = this.context.require();

    // Asserted HERE rather than relying on `runInternal` further down, because
    // several methods take an early exit before they ever open a transaction. A
    // customer session reaching one of those would get an empty list, which reads
    // as "no work today" and hides the fact that they should not have been asked.
    if (!actor.isInternal) {
      throw new ForbiddenException('The pricing queue is internal to Noatum.');
    }

    return actor;
  }
}
