import type { Prisma } from '@prisma/client';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  acceptQuoteSchema,
  chargeableWeight,
  createQuoteSchema,
  customerStageFor,
  dangerousGoodsFor,
  declineQuoteSchema,
  equipmentFor,
  oversizeItemsFor,
  temperatureControlFor,
  CUSTOMER_QUOTE_STAGES,
  type CustomerQuoteDto,
  type CustomerQuoteListDto,
  type CustomerQuoteSummaryDto,
  type QuoteRateResultDto,
  type QuoteStatus,
} from '../../contracts';

import { cargoFor } from './quote-cargo';
import { quoteFilterWhere } from './quote-filters';
import {
  countPipeline,
  daysRemaining,
  isPipelineSegment,
  pipelineSegmentFor,
  pipelineSegmentWhere,
} from './quote-pipeline';

import { AnalyticsService } from '../../common/analytics/analytics.service';
import { FeatureSwitchService } from '../../common/features/feature-switch.service';
import { SettingsService } from '../../common/settings/settings.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { TenantRepository, type TenantClient } from '../../common/tenancy/tenant.repository';
import { RateEngineAdapter } from '../../contracts/adapters/rate-engine.adapter';
import type { TmsQuotePackage, TmsQuoteRequest } from '../../contracts/adapters/tms-quote.adapter';
import {
  INTEGRATION_OPERATIONS,
  IntegrationMessageService,
} from '../../integration/messages/integration-message.service';

import { assertTransition, CUSTOMER_QUOTE_BADGE } from './quote.status';

/** The option shape `forCustomer` projects from. Mirrors the Prisma row it reads. */
interface CustomerVisibleOption {
  id: string;
  position: number;
  name: string | null;
  carrierName: string | null;
  serviceRouting: string | null;
  transitDaysMin: number | null;
  transitDaysMax: number | null;
  nextDepartures: string | null;
  freeTimeDays: number | null;
  totalMinorUnits: bigint | null;
  currency: string | null;
  validUntil: Date | null;
  isRecommended: boolean;
  notes: string | null;
  termsIncluded: string | null;
  termsExcluded: string | null;
  termsPayment: string | null;
  termsSubjectTo: string | null;
  chargeLines: {
    description: string;
    basis: string | null;
    quantity: unknown;
    amountMinorUnits: bigint;
    currency: string;
  }[];
}

/**
 * The quote row `forCustomer` reads from.
 *
 * Written out rather than inferred so that adding a column to `quote` does not silently
 * widen what the customer sees. A new field has to be added here AND to the projection
 * AND to `CustomerQuoteDto` before it can reach a customer - which is the point.
 */
interface CustomerReadableQuote {
  id: string;
  reference: string;
  status: string;
  version: number;
  mode: string;
  loadType: string | null;
  originCode: string;
  destinationCode: string;
  incoterm: string | null;
  readyDate: Date | null;
  customerReference: string | null;
  serviceLevel: string | null;
  grossWeightKg: unknown;
  volumeM3: unknown;
  chargeableKg: unknown;
  notes: string | null;
  payload: unknown;
  totalMinorUnits: bigint | null;
  currency: string | null;
  validUntil: Date | null;
  messageToCustomer: string | null;
  publishedAt: Date | null;
  decidedAt: Date | null;
  acceptedOptionId: string | null;
  declineReason: string | null;
  createdAt: Date;
  options: CustomerVisibleOption[];
  dangerousGoods: Parameters<typeof dangerousGoodsFor>[0];
  equipment: Parameters<typeof equipmentFor>[0];
  temperatureControl: Parameters<typeof temperatureControlFor>[0];
  oversizeItems: Parameters<typeof oversizeItemsFor>[0];
}

/**
 * Prisma returns `Decimal`, which serialises as a STRING while the generated client
 * types these as numbers. Converting at the projection keeps the contract honest.
 */
function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A request the customer may still withdraw: anything nobody has answered yet. */
const WITHDRAWABLE = ['draft', 'requested', 'claimed', 'priced', 'approved', 'submitted'] as const;

/**
 * The statuses behind one customer-facing badge.
 *
 * Filtering happens on what the customer can see, not on our workflow - they have
 * no idea `approved` exists, and should not learn it from a filter dropdown.
 */
function badgeStatuses(badge: string | undefined): QuoteStatus[] | null {
  switch (badge) {
    case 'draft':
      return ['draft'];
    case 'requested':
      return ['requested', 'submitted'];
    case 'in_progress':
      return ['claimed', 'priced', 'approved', 'pending_sync'];
    case 'quoted':
      return ['published', 'quoted', 'rated'];
    case 'accepted':
      return ['accepted'];
    case 'rejected':
      return ['rejected'];
    case 'expired':
      return ['expired'];
    case 'withdrawn':
      return ['withdrawn'];
    default:
      return null;
  }
}

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
    private readonly rateEngine: RateEngineAdapter,
    private readonly analytics: AnalyticsService,
    private readonly settings: SettingsService,
    private readonly switches: FeatureSwitchService,
    private readonly messages: IntegrationMessageService,
  ) {}

  /**
   * Every method on this service is a customer route.
   *
   * Staff hold `quotes.read` on three presets and the tenancy policy reads through for
   * an internal session, so without this each route was a cross-tenant, cross-branch
   * view of every customer's quotes - and `rate()` a cross-tenant write. Staff have the
   * branch-scoped pricing queue instead.
   *
   * 404, not 403: an internal caller on the wrong route should learn nothing.
   */
  private requireCustomer(): void {
    if (this.context.require().isInternal) {
      throw new NotFoundException('Quote not found.');
    }
  }

  /**
   * The per-user organisation restriction, as a query fragment.
   *
   * `user_account_access` stores a RESTRICTION - no rows means every account - and the
   * customer-administration screen tells the administrator it governs "shipments,
   * quotes, documents and invoices". It governed the first and the last; quotes ignored
   * it entirely, so a user narrowed to one organisation read all of them.
   *
   * A quote filed against no account stays visible: it belongs to the company rather
   * than to one of its organisations, and hiding it would lose it.
   */
  private accountScope(): Prisma.QuoteWhereInput | null {
    const { accountIds } = this.context.require();

    if (accountIds.length === 0) {
      return null;
    }

    return { OR: [{ accountId: { in: accountIds } }, { accountId: null }] };
  }

  /**
   * The customer's quote list.
   *
   * Offset paging, not a cursor, because this feeds `ListingGrid` - the shared
   * listing every screen in the product uses - and that shows "showing 1-25 of
   * 140". A cursor cannot answer "of 140".
   *
   * No customer_group_id filter here on purpose: RLS applies it, and duplicating
   * the predicate in application code would hide a policy regression rather than
   * expose it.
   */
  async list(params: {
    search?: string;
    badge?: string;
    segment?: string;
    view?: string;
    mode?: string;
    requestedFrom?: string;
    requestedTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CustomerQuoteListDto> {
    this.requireCustomer();

    const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);
    const page = Math.max(params.page ?? 1, 1);
    const search = params.search?.trim() ?? '';

    // One clock for the whole answer. Reading `new Date()` again inside the row
    // mapper would let a quote three days out be counted under one segment and
    // drawn under another, on a slow query, once in a while - the worst kind.
    const now = new Date();

    // The badge is a coarse grouping of several statuses, so a filter on it maps
    // back to the set it collapses - the customer is filtering on what they can
    // see, not on our workflow.
    const statuses = badgeStatuses(params.badge);

    return this.repo.run(async (tx) => {
      // Composed with AND rather than spread: the account restriction and the search
      // are both OR groups, and spreading two `OR` keys into one object silently keeps
      // only the last.
      const conditions: Prisma.QuoteWhereInput[] = [];

      const accounts = this.accountScope();
      if (accounts !== null) {
        conditions.push(accounts);
      }

      // The drawer's filters join the scope, so the band counts within them.
      conditions.push(...quoteFilterWhere(params));

      if (search) {
        conditions.push({
          OR: [
            { reference: { contains: search, mode: 'insensitive' as const } },
            { customerReference: { contains: search, mode: 'insensitive' as const } },
            { originCode: { contains: search, mode: 'insensitive' as const } },
            { destinationCode: { contains: search, mode: 'insensitive' as const } },
          ],
        });
      }

      /*
       * The scope is everything the customer may see once search and account
       * restriction are applied, but BEFORE the segment and the saved view. The
       * band counts against it, so picking "Expiring soon" leaves the other five
       * chips showing what they would show if you unpicked it - a band whose
       * other numbers all fall to zero the moment you use it is a band nobody can
       * navigate with.
       */
      const scope: Prisma.QuoteWhereInput = {
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(conditions.length > 0 ? { AND: conditions } : {}),
      };

      const narrowing: Prisma.QuoteWhereInput[] = [scope];

      if (params.segment && isPipelineSegment(params.segment)) {
        narrowing.push(pipelineSegmentWhere(params.segment, now));
      }

      // Saved views, as the listing's pill row offers them. Both are ordinary
      // segment unions - nothing here is a new concept the customer has to learn.
      if (params.view === 'needs_decision') {
        narrowing.push({
          OR: [
            pipelineSegmentWhere('options_ready', now),
            pipelineSegmentWhere('expiring_soon', now),
          ],
        });
      } else if (params.view === 'accepted') {
        narrowing.push(pipelineSegmentWhere('accepted', now));
      }

      const where: Prisma.QuoteWhereInput = { AND: narrowing };

      const [rows, total, pipeline, group] = await Promise.all([
        tx.quote.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            options: { select: { id: true, validUntil: true, isRecommended: true } },
            equipment: { select: { quantity: true, containerType: true, position: true } },
          },
        }),
        tx.quote.count({ where }),
        countPipeline((clause) => tx.quote.count({ where: clause }), scope, now),
        // No id in the filter on purpose: RLS answers with the caller's own group
        // and nothing else, so naming one here would be a second, weaker copy of
        // the rule that is already enforced.
        tx.customerGroup.findFirst({ select: { name: true } }),
      ]);

      return {
        items: rows.map((row) => this.summaryFor(row, now)),
        total,
        pipeline,
        customerName: group?.name ?? null,
      };
    });
  }

  async getById(id: string): Promise<CustomerQuoteDto> {
    this.requireCustomer();

    const quote = await this.repo.run((tx) =>
      tx.quote.findUnique({
        where: { id },
        include: {
          options: {
            orderBy: { position: 'asc' },
            include: { chargeLines: { orderBy: { position: 'asc' } } },
          },
          dangerousGoods: { orderBy: { position: 'asc' } },
          equipment: { orderBy: { position: 'asc' } },
          temperatureControl: true,
          oversizeItems: { orderBy: { position: 'asc' } },
        },
      }),
    );

    // RLS turns another tenant's quote into "no rows", which surfaces here as a 404.
    // That is intentional: a 403 would confirm the id exists.
    if (!quote) {
      throw new NotFoundException('Quote not found.');
    }

    // The same per-user organisation restriction the list applies. Without it a user
    // narrowed to one organisation could still open any of their company's quotes by id.
    const { accountIds } = this.context.require();
    if (accountIds.length > 0 && quote.accountId !== null && !accountIds.includes(quote.accountId)) {
      throw new NotFoundException('Quote not found.');
    }

    // Resolved for the customer's own group, so a customer served by a branch
    // that discloses carriers sees them and one served by a branch that does not
    // sees "disclosed on booking".
    const disclose = await this.settings.get('quotations.disclose', {
      customerGroupId: quote.customerGroupId,
    });

    return this.forCustomer(quote, disclose);
  }

  /**
   * Sends a draft to the pricing queue.
   *
   * The only transition the customer makes on the way in, and the point at which
   * the quote stops being theirs to edit.
   */
  async submit(id: string): Promise<{ status: string; reference: string }> {
    this.requireCustomer();
    const actor = this.context.require();

    // Read before the transaction: a switch lookup is not part of the business
    // write, and holding the row lock while we read a different table is how a
    // submit ends up waiting on an unrelated query.
    const sendToCargoWise = await this.switches.isEnabled('quotations.cw1_request_sync');

    return this.repo.run(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id },
        select: {
          status: true,
          reference: true,
          customerGroupId: true,
          _count: { select: { dangerousGoods: true } },
        },
      });

      if (!quote) throw new NotFoundException('Quote not found.');

      if (quote.status !== 'draft') {
        throw new ConflictException(`A quote with status ${quote.status} cannot be sent.`);
      }

      assertTransition(quote.status as QuoteStatus, 'requested');

      const sent = await tx.quote.updateMany({
        where: { id, status: 'draft' },
        data: { status: 'requested' },
      });

      if (sent.count === 0) {
        throw new ConflictException('This quote has already been sent.');
      }

      await tx.auditEvent.create({
        data: {
          customerGroupId: quote.customerGroupId,
          actorUserId: actor.userId,
          action: 'quote.requested',
          entityType: 'quote',
          entityId: id,
          // Recorded here because "when was this hazard declared, and by whom" is
          // asked after an incident, when the row's own timestamps are not enough.
          metadata: { dangerousGoodsCount: quote._count.dangerousGoods },
        },
      });

      await this.analytics.recordIn(tx, {
        action: 'quote.requested',
        entityType: 'quote',
        entityId: id,
      });

      // C6. Written in the same transaction as the status change, so a request can
      // never be `requested` with the instruction to tell CargoWise lost. Nothing
      // the customer sees depends on it, and nothing is sent from here - the relay
      // finds no transport and leaves the row pending, which is the hold.
      await this.messages.recordOutbound(tx, {
        operation: INTEGRATION_OPERATIONS.QUOTE_REQUEST_CREATE,
        portalRef: quote.reference,
        idempotencyKey: `${quote.reference}:v1`,
        payload: await this.outboundRequestPayload(tx, id, quote.reference),
        customerGroupId: quote.customerGroupId,
        createdByUserId: actor.userId,
        // With the switch off the row is still written, as `skipped`: a missing row
        // could not tell us later whether we chose not to send or simply lost it.
        skip: !sendToCargoWise,
      });

      return { status: 'requested', reference: quote.reference };
    });
  }

  /**
   * The request as CargoWise should see it.
   *
   * Carries the hazards, the containers and the special handling, not just the
   * lane and the weight: whoever prices this cannot quote a class 3 cargo they
   * were never told about, and a copy that omits them is a worse record than no
   * copy at all.
   */
  private async outboundRequestPayload(
    tx: TenantClient,
    id: string,
    reference: string,
  ): Promise<Record<string, unknown>> {
    const quote = await tx.quote.findUniqueOrThrow({
      where: { id },
      include: {
        account: { select: { cw1OrgCode: true } },
        dangerousGoods: { orderBy: { position: 'asc' } },
        equipment: { orderBy: { position: 'asc' } },
        temperatureControl: true,
        oversizeItems: { orderBy: { position: 'asc' } },
      },
    });

    const payload = (quote.payload ?? {}) as Record<string, unknown>;
    const orgCode = quote.account?.cw1OrgCode ?? null;

    if (orgCode === null) {
      // Recorded, not thrown: the customer's request is valid and must not fail
      // because we cannot decide which of their organisations it belongs to.
      // Operations need to know it will not file at the far end.
      this.logger.warn(
        `Quote ${reference} has no organisation code; the CargoWise copy cannot be filed.`,
      );
    }

    const request: TmsQuoteRequest = {
      reference,
      idempotencyKey: `${reference}:v1`,
      orgCode,
      mode: quote.mode as TmsQuoteRequest['mode'],
      loadType: quote.loadType ?? null,
      commodity: typeof payload.commodity === 'string' ? payload.commodity : null,
      originCode: quote.originCode,
      destinationCode: quote.destinationCode,
      incoterm: quote.incoterm ?? null,
      readyDate: quote.readyDate ?? null,
      grossWeightKg: quote.grossWeightKg === null ? null : Number(quote.grossWeightKg),
      volumeM3: quote.volumeM3 === null ? null : Number(quote.volumeM3),
      chargeableKg: quote.chargeableKg === null ? null : Number(quote.chargeableKg),
      packages: asPackageArray(payload.packages),
      equipment: quote.equipment.map((unit) => ({
        unitId: unit.unitId,
        containerType: unit.containerType,
        quantity: unit.quantity,
        grossWeightPerUnitKg:
          unit.grossWeightPerUnitKg === null ? null : Number(unit.grossWeightPerUnitKg),
      })),
      dangerousGoods: quote.dangerousGoods.map((entry) => ({
        unNumber: entry.unNumber,
        hazardClass: entry.hazardClass,
        subsidiaryRisks: entry.subsidiaryRisks,
        properShippingName: entry.properShippingName,
        packingGroup: entry.packingGroup,
        technicalName: entry.technicalName,
        flashpointCelsius:
          entry.flashpointCelsius === null ? null : Number(entry.flashpointCelsius),
        emsCode: entry.emsCode,
        isMarinePollutant: entry.isMarinePollutant,
        packagingType: entry.packagingType,
        unPackagingCode: entry.unPackagingCode,
        packageCount: entry.packageCount,
        netQuantityPerPackage: Number(entry.netQuantityPerPackage),
        quantityUnit: entry.quantityUnit,
        transportRegime: entry.transportRegime,
        isInOverpack: entry.isInOverpack,
        appliesToLines: entry.appliesToLines,
      })),
      temperatureControl: quote.temperatureControl
        ? {
            setPointCelsius: Number(quote.temperatureControl.setPointCelsius),
            toleranceCelsius:
              quote.temperatureControl.toleranceCelsius === null
                ? null
                : Number(quote.temperatureControl.toleranceCelsius),
            ventilation: quote.temperatureControl.ventilation,
            controlledAtmosphere: quote.temperatureControl.controlledAtmosphere,
            preCoolingRequired: quote.temperatureControl.preCoolingRequired,
            dataLogger: quote.temperatureControl.dataLogger,
          }
        : null,
      oversizeItems: quote.oversizeItems.map((item) => ({
        description: item.description,
        lengthCm: Number(item.lengthCm),
        widthCm: Number(item.widthCm),
        heightCm: Number(item.heightCm),
        weightKg: Number(item.weightKg),
        liftingMethod: item.liftingMethod,
      })),
      customerReference: quote.customerReference ?? null,
      serviceLevel: quote.serviceLevel ?? null,
      notes: quote.notes ?? null,
      requestedAt: new Date(),
    };

    // Dates do not survive JSONB as Dates, so the stored message carries ISO
    // strings. The transport parses them back; the canonical shape is the type above.
    return JSON.parse(JSON.stringify(request)) as Record<string, unknown>;
  }

  /**
   * The customer's commercial outcome, handed over the same way the request was.
   *
   * Written in the caller's transaction so a quote can never be `accepted` with
   * the instruction to tell CargoWise lost - the acceptance is the commercially
   * binding event, so losing its copy is the worst of the three to lose.
   *
   * One decision per quote, so the key needs no version: accepting and declining
   * are both terminal and a quote cannot reach either twice.
   */
  private async recordDecisionCopy(
    tx: TenantClient,
    input: {
      reference: string;
      customerGroupId: string;
      actorUserId: string | null;
      outcome: 'accepted' | 'rejected' | 'withdrawn';
      reason: string | null;
      optionId?: string | null;
    },
  ): Promise<void> {
    const withdrawn = input.outcome === 'withdrawn';

    await this.messages.recordOutbound(tx, {
      operation: withdrawn
        ? INTEGRATION_OPERATIONS.QUOTE_REQUEST_CANCEL
        : INTEGRATION_OPERATIONS.QUOTE_DECISION_RECORD,
      portalRef: input.reference,
      idempotencyKey: `${input.reference}:${withdrawn ? 'cancel' : 'decision'}`,
      payload: {
        reference: input.reference,
        outcome: input.outcome,
        reason: input.reason,
        acceptedOptionId: input.optionId ?? null,
        decidedAt: new Date().toISOString(),
      },
      customerGroupId: input.customerGroupId,
      createdByUserId: input.actorUserId,
      skip: !(await this.switches.isEnabled('quotations.cw1_request_sync')),
    });
  }

  /**
   * Accepts one option.
   *
   * The version is part of the request, not decoration. A customer reading
   * version 1 while a pricer publishes version 2 must not be bound to a price
   * nobody is offering any more - so a stale version is a 409 telling them to
   * look again, never a silent upgrade to the current one.
   */
  async accept(id: string, body: unknown): Promise<{ status: string }> {
    this.requireCustomer();
    const actor = this.context.require();
    const parsed = acceptQuoteSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return this.repo.run(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id },
        select: {
          status: true,
          version: true,
          reference: true,
          customerGroupId: true,
          options: { select: { id: true, validUntil: true } },
        },
      });

      if (!quote) throw new NotFoundException('Quote not found.');

      if (quote.status !== 'published') {
        throw new ConflictException('Only a published quote can be accepted.');
      }

      if (quote.version !== parsed.data.version) {
        throw new ConflictException(
          'This quote has been re-priced since you opened it. Please review the new version.',
        );
      }

      const option = quote.options.find((candidate) => candidate.id === parsed.data.optionId);

      if (!option) {
        throw new BadRequestException('That option does not belong to this quote.');
      }

      if (option.validUntil !== null && option.validUntil.getTime() < Date.now()) {
        throw new ConflictException('That option has passed its validity date.');
      }

      assertTransition(quote.status as QuoteStatus, 'accepted');

      // Conditional update, and the row count is the answer. Reading the status and
      // version and then writing unconditionally leaves a window at READ COMMITTED in
      // which a pricer re-prices between the two - and because a re-price deletes the
      // option set and `accepted_option_id` is ON DELETE SET NULL, the result was an
      // accepted quote sitting at `priced` with no option attached. `claim()` already
      // does it this way; this is the same defect class.
      const decided = await tx.quote.updateMany({
        where: { id, status: 'published', version: quote.version },
        data: {
          status: 'accepted',
          acceptedOptionId: option.id,
          decidedAt: new Date(),
          decidedById: actor.userId,
        },
      });

      if (decided.count === 0) {
        throw new ConflictException(
          'This quote changed while you were deciding. Please review it again.',
        );
      }

      await tx.auditEvent.create({
        data: {
          customerGroupId: quote.customerGroupId,
          actorUserId: actor.userId,
          action: 'quote.accepted',
          entityType: 'quote',
          entityId: id,
          metadata: { optionId: option.id, version: quote.version },
        },
      });

      await this.analytics.recordIn(tx, {
        action: 'quote.accepted',
        entityType: 'quote',
        entityId: id,
        metadata: { version: quote.version },
      });

      await this.recordDecisionCopy(tx, {
        reference: quote.reference,
        customerGroupId: quote.customerGroupId,
        actorUserId: actor.userId,
        outcome: 'accepted',
        reason: null,
        optionId: option.id,
      });

      return { status: 'accepted' };
    });
  }

  /** Declines the whole quote. The reason is optional and stored as given. */
  async decline(id: string, body: unknown): Promise<{ status: string }> {
    this.requireCustomer();
    const actor = this.context.require();
    const parsed = declineQuoteSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return this.repo.run(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id },
        select: { status: true, reference: true, customerGroupId: true },
      });

      if (!quote) throw new NotFoundException('Quote not found.');

      if (quote.status !== 'published') {
        throw new ConflictException('Only a published quote can be declined.');
      }

      assertTransition(quote.status as QuoteStatus, 'rejected');

      const decided = await tx.quote.updateMany({
        where: { id, status: 'published' },
        data: {
          status: 'rejected',
          declineReason: parsed.data.reason ?? null,
          decidedAt: new Date(),
          decidedById: actor.userId,
        },
      });

      if (decided.count === 0) {
        throw new ConflictException(
          'This quote changed while you were deciding. Please review it again.',
        );
      }

      await tx.auditEvent.create({
        data: {
          customerGroupId: quote.customerGroupId,
          actorUserId: actor.userId,
          action: 'quote.rejected',
          entityType: 'quote',
          entityId: id,
          metadata: { reason: parsed.data.reason ?? null },
        },
      });

      await this.analytics.recordIn(tx, {
        action: 'quote.rejected',
        entityType: 'quote',
        entityId: id,
        customerGroupId: quote.customerGroupId,
      });

      await this.recordDecisionCopy(tx, {
        reference: quote.reference,
        customerGroupId: quote.customerGroupId,
        actorUserId: actor.userId,
        outcome: 'rejected',
        reason: parsed.data.reason ?? null,
      });

      return { status: 'rejected' };
    });
  }

  /**
   * Withdraws a request that has not been answered yet.
   *
   * Allowed while somebody may already be pricing it - the banner on the customer
   * screen says as much - because a customer whose need has gone should be able
   * to stop work rather than wait politely for an answer they no longer want.
   */
  async cancel(id: string): Promise<{ status: string }> {
    this.requireCustomer();
    const actor = this.context.require();

    return this.repo.run(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id },
        select: { status: true, reference: true, customerGroupId: true },
      });

      if (!quote) throw new NotFoundException('Quote not found.');

      if (!WITHDRAWABLE.includes(quote.status as (typeof WITHDRAWABLE)[number])) {
        throw new ConflictException(`A quote with status ${quote.status} cannot be cancelled.`);
      }

      assertTransition(quote.status as QuoteStatus, 'withdrawn');

      const withdrawn = await tx.quote.updateMany({
        where: { id, status: quote.status },
        data: { status: 'withdrawn', claimedById: null, claimedAt: null },
      });

      if (withdrawn.count === 0) {
        throw new ConflictException(
          'This quote changed while you were cancelling it. Please review it again.',
        );
      }

      await tx.auditEvent.create({
        data: {
          customerGroupId: quote.customerGroupId,
          actorUserId: actor.userId,
          action: 'quote.withdrawn',
          entityType: 'quote',
          entityId: id,
          metadata: { from: quote.status },
        },
      });

      await this.analytics.recordIn(tx, {
        action: 'quote.withdrawn',
        entityType: 'quote',
        entityId: id,
        customerGroupId: quote.customerGroupId,
      });

      // Only worth cancelling a request CargoWise was told about: a draft never
      // left the building, so there is nothing out there to withdraw.
      if (quote.status !== 'draft') {
        await this.recordDecisionCopy(tx, {
          reference: quote.reference,
          customerGroupId: quote.customerGroupId,
          actorUserId: actor.userId,
          outcome: 'withdrawn',
          reason: null,
        });
      }

      return { status: 'withdrawn' };
    });
  }

  private summaryFor(
    row: {
      id: string; reference: string; status: string; mode: string;
      originCode: string; destinationCode: string; customerReference: string | null;
      version: number; totalMinorUnits: bigint | null; currency: string | null;
      validUntil: Date | null; createdAt: Date;
      loadType?: string | null; grossWeightKg?: unknown; volumeM3?: unknown; payload?: unknown;
      equipment?: { quantity: number; containerType: string; position?: number }[];
      options: { id: string; validUntil: Date | null; isRecommended: boolean }[];
    },
    now: Date = new Date(),
  ): CustomerQuoteSummaryDto {
    const published = row.status === 'published';
    const inDate = row.validUntil === null || row.validUntil.getTime() >= now.getTime();

    return {
      id: row.id,
      reference: row.reference,
      statusBadge: CUSTOMER_QUOTE_BADGE[row.status as QuoteStatus],
      mode: row.mode,
      originCode: row.originCode,
      destinationCode: row.destinationCode,
      customerReference: row.customerReference,
      version: row.version,
      // Figures appear with the offer, not before it. A total on an unpublished
      // quote would be a price the customer was never shown.
      totalMinorUnits: published && row.totalMinorUnits !== null ? Number(row.totalMinorUnits) : null,
      currency: published ? row.currency : null,
      validUntil: published ? (row.validUntil?.toISOString() ?? null) : null,
      createdAt: row.createdAt.toISOString(),
      optionCount: published ? row.options.length : 0,
      awaitingDecision: published && inDate,
      cargo: cargoFor({
        loadType: row.loadType ?? null,
        grossWeightKg: row.grossWeightKg,
        volumeM3: row.volumeM3,
        payload: row.payload,
        equipment: row.equipment,
      }),
      // Same rule as the figures: no countdown on an offer that was never made.
      daysRemaining: published ? daysRemaining(row.validUntil, now) : null,
      pipelineSegment: pipelineSegmentFor(row.status, published ? row.validUntil : null, now),
    };
  }

  /**
   * Builds what the customer may see, field by field.
   *
   * An ALLOW-LIST, deliberately. The previous shape removed a list of internal fields
   * and spread the rest, which meant every column added to `quote` afterwards reached
   * the customer by default - and three already did: the headline figures and the
   * pricer's covering message, written at `priced` and read before anyone published.
   *
   * Three separate protections meet here, and they fail differently.
   *
   * Cost never appears because it lives in `quote_charge_line_cost`, which a customer
   * session's RLS policy denies outright - it is not omitted here, it was never
   * fetched. This method could be deleted entirely and cost would still be safe.
   *
   * Staff identities are simply never listed. The mockup's customer activity log reads
   * "Claimed by pricing team - Noatum Valencia": the branch, never the person. That
   * includes `pricedById` and `approvedById` - naming the second approver would invite
   * exactly the conversation four-eyes exists to avoid.
   *
   * The offer itself - figures, validity, covering message and options - is gated on
   * `published`, because a price that has been typed but not released is not an offer.
   * All four are gated by the same expression, so they cannot drift apart.
   */
  private forCustomer(
    quote: CustomerReadableQuote,
    disclosesCarrier: boolean,
  ): CustomerQuoteDto {
    const published = quote.status === 'published';
    const now = Date.now();
    const stageIndex = customerStageFor(quote.status);
    // Clamped both ends: an unmapped status must land on a real stage rather than
    // producing `undefined` in a contract that advertises an enum.
    const stage =
      CUSTOMER_QUOTE_STAGES[
        Math.min(Math.max(stageIndex - 1, 0), CUSTOMER_QUOTE_STAGES.length - 1)
      ] ?? CUSTOMER_QUOTE_STAGES[0];

    return {
      id: quote.id,
      reference: quote.reference,
      status: quote.status,
      statusBadge: CUSTOMER_QUOTE_BADGE[quote.status as QuoteStatus],
      stage,
      stageIndex,
      version: quote.version,
      mode: quote.mode,
      loadType: quote.loadType,
      originCode: quote.originCode,
      destinationCode: quote.destinationCode,
      incoterm: quote.incoterm,
      readyDate: quote.readyDate?.toISOString() ?? null,
      customerReference: quote.customerReference,
      serviceLevel: quote.serviceLevel,
      // Prisma Decimal does not survive JSON as a number; the generated client types
      // these as numbers, so the conversion happens here rather than at the edge.
      grossWeightKg: decimalToNumber(quote.grossWeightKg),
      volumeM3: decimalToNumber(quote.volumeM3),
      chargeableKg: decimalToNumber(quote.chargeableKg),
      notes: quote.notes,
      payload: (quote.payload ?? {}) as Record<string, unknown>,

      // The offer. Nothing below this line exists for the customer until publication.
      totalMinorUnits:
        published && quote.totalMinorUnits !== null ? Number(quote.totalMinorUnits) : null,
      currency: published ? quote.currency : null,
      validUntil: published ? (quote.validUntil?.toISOString() ?? null) : null,
      messageToCustomer: published ? quote.messageToCustomer : null,

      publishedAt: quote.publishedAt?.toISOString() ?? null,
      decidedAt: quote.decidedAt?.toISOString() ?? null,
      acceptedOptionId: quote.acceptedOptionId,
      declineReason: quote.declineReason,
      createdAt: quote.createdAt.toISOString(),
      optionCount: published ? quote.options.length : 0,
      awaitingDecision:
        published && (quote.validUntil === null || quote.validUntil.getTime() >= now),

      // Inherited from the summary, so the detail cannot advertise a field it does
      // not send. Same derivations, same clock.
      cargo: cargoFor({
        loadType: quote.loadType,
        grossWeightKg: quote.grossWeightKg,
        volumeM3: quote.volumeM3,
        payload: quote.payload,
        equipment: quote.equipment,
      }),
      daysRemaining: published ? daysRemaining(quote.validUntil, new Date(now)) : null,
      pipelineSegment: pipelineSegmentFor(
        quote.status,
        published ? quote.validUntil : null,
        new Date(now),
      ),

      // Always shown back, at every status: the customer must be able to check what
      // they declared, and a hazard is not something to reveal on publish.
      dangerousGoods: dangerousGoodsFor(quote.dangerousGoods),
      equipment: equipmentFor(quote.equipment),
      temperatureControl: temperatureControlFor(quote.temperatureControl),
      oversizeItems: oversizeItemsFor(quote.oversizeItems),

      options: published
        ? quote.options.map((option) => ({
            id: option.id,
            position: option.position,
            name: option.name,
            // Null, not omitted: the screen prints "disclosed on booking" for a
            // null, and an absent key would render a blank row instead.
            carrierName: disclosesCarrier ? option.carrierName : null,
            serviceRouting: option.serviceRouting,
            transitDaysMin: option.transitDaysMin,
            transitDaysMax: option.transitDaysMax,
            nextDepartures: option.nextDepartures,
            freeTimeDays: option.freeTimeDays,
            totalMinorUnits:
              option.totalMinorUnits === null ? null : Number(option.totalMinorUnits),
            currency: option.currency,
            validUntil: option.validUntil?.toISOString() ?? null,
            isRecommended: option.isRecommended,
            // Decided by the server clock, which is the clock that will refuse the
            // acceptance. A browser with a wrong date must not be offered a button
            // the API is about to reject.
            isExpired: option.validUntil !== null && option.validUntil.getTime() < now,
            notes: option.notes,
            termsIncluded: option.termsIncluded,
            termsExcluded: option.termsExcluded,
            termsPayment: option.termsPayment,
            termsSubjectTo: option.termsSubjectTo,
            chargeLines: option.chargeLines.map((line) => ({
              description: line.description,
              basis: line.basis,
              quantity: Number(line.quantity),
              amountMinorUnits: Number(line.amountMinorUnits),
              currency: line.currency,
            })),
          }))
        : [],
    };
  }

  async create(input: unknown) {
    this.requireCustomer();
    const data = createQuoteSchema.parse(input);
    const { userId } = this.context.require();

    const dangerousGoods = data.dangerousGoods ?? [];

    // Refused at the entrance, not after the quote row exists. A branch that does
    // not accept hazardous cargo must not end up holding a request for some.
    if (dangerousGoods.length > 0 && !(await this.switches.isEnabled('quotations.dangerous_goods'))) {
      throw new ForbiddenException({
        message: 'Dangerous goods requests are not available. Please contact us to arrange this shipment.',
        details: { code: 'DANGEROUS_GOODS_UNAVAILABLE' },
      });
    }

    // Give every line an id before anything points at one. Callers that declare
    // dangerous goods send their own - the schema refuses an entry naming a line
    // that was not submitted - and the rest get one here so the stored request is
    // the same shape either way.
    const packages = data.packages?.map((line, index) => ({
      ...line,
      lineId: line.lineId ?? `line-${index + 1}`,
    }));

    const chargeableKg = chargeableWeight({
      mode: data.mode,
      grossWeightKg: data.grossWeightKg,
      volumeM3: data.volumeM3,
    });

    return this.repo.run(async (tx) => {
      const groupId = this.context.requireGroupId();
      const accountId = await this.resolveAccountId(tx, groupId, data.accountId);

      return tx.quote.create({
        data: {
          customerGroupId: groupId,
          accountId,
          reference: await this.nextReference(tx, groupId),
          mode: data.mode,
          loadType: data.loadType ?? null,
          originCode: data.originCode,
          destinationCode: data.destinationCode,
          incoterm: data.incoterm ?? null,
          readyDate: data.readyDate ?? null,
          customerReference: data.customerReference ?? null,
          serviceLevel: data.serviceLevel ?? null,
          currency: data.currency,
          notes: data.notes ?? null,
          // Package lines ride in the payload rather than in their own table: nothing
          // filters or reports on them yet, and a table would be a schema we cannot
          // justify. They are part of the submitted request and must survive.
          payload: {
            ...(data.payload ?? {}),
            commodity: data.commodity,
            ...(packages ? { packages } : {}),
          },
          grossWeightKg: data.grossWeightKg,
          volumeM3: data.volumeM3 ?? null,
          chargeableKg,
          createdById: userId,
          // Written in the same statement as the quote, so a request can never be
          // stored with its hazards missing.
          dangerousGoods: {
            create: dangerousGoods.map((entry, index) => ({
              position: index + 1,
              unNumber: entry.unNumber,
              hazardClass: entry.hazardClass,
              properShippingName: entry.properShippingName,
              subsidiaryRisks: entry.subsidiaryRisks ?? [],
              // 'NONE' is stored, not null: "this entry is not assigned one" and
              // "nobody filled it in" must stay distinguishable.
              packingGroup: entry.packingGroup,
              technicalName: entry.technicalName ?? null,
              flashpointCelsius: entry.flashpointCelsius ?? null,
              emsCode: entry.emsCode ?? null,
              isMarinePollutant: entry.isMarinePollutant ?? false,
              packagingType: entry.packagingType,
              unPackagingCode: entry.unPackagingCode ?? null,
              packageCount: entry.packageCount,
              netQuantityPerPackage: entry.netQuantityPerPackage,
              quantityUnit: entry.quantityUnit,
              transportRegime: entry.transportRegime ?? null,
              isInOverpack: entry.isInOverpack ?? false,
              appliesToLines: entry.appliesToLines,
              notes: entry.notes ?? null,
            })),
          },
          equipment: {
            create: (data.equipment ?? []).map((unit, index) => ({
              position: index + 1,
              unitId: unit.unitId,
              containerType: unit.containerType,
              quantity: unit.quantity,
              grossWeightPerUnitKg: unit.grossWeightPerUnitKg ?? null,
              notes: unit.notes ?? null,
            })),
          },
          // One row or none; its existence is what makes this a reefer.
          temperatureControl: data.temperatureControl
            ? {
                create: {
                  setPointCelsius: data.temperatureControl.setPointCelsius,
                  toleranceCelsius: data.temperatureControl.toleranceCelsius ?? null,
                  ventilation: data.temperatureControl.ventilation ?? null,
                  controlledAtmosphere: data.temperatureControl.controlledAtmosphere ?? false,
                  preCoolingRequired: data.temperatureControl.preCoolingRequired ?? false,
                  dataLogger: data.temperatureControl.dataLogger ?? null,
                  notes: data.temperatureControl.notes ?? null,
                },
              }
            : undefined,
          oversizeItems: {
            create: (data.oversizeItems ?? []).map((item, index) => ({
              position: index + 1,
              description: item.description,
              lengthCm: item.lengthCm,
              widthCm: item.widthCm,
              heightCm: item.heightCm,
              weightKg: item.weightKg,
              liftingMethod: item.liftingMethod ?? null,
              notes: item.notes ?? null,
            })),
          },
        },
        // Only what the caller needs to navigate. Returning the raw row would hand
        // the browser Prisma Decimals typed as numbers and, once a price exists, a
        // BigInt that throws inside res.json.
        select: { id: true, reference: true, status: true },
      });
    });
  }

  /**
   * An account id arrives from the browser, so it is a claim rather than a fact.
   *
   * RLS would hide another tenant's account from a customer, but internal staff read
   * through it, so the ownership test is made explicitly here instead of relying on a
   * policy that does not apply to every caller.
   */
  private async resolveAccountId(
    tx: Parameters<Parameters<TenantRepository['run']>[0]>[0],
    groupId: string,
    accountId: string | undefined,
  ): Promise<string | null> {
    if (!accountId) {
      return this.inferAccountId(tx, groupId);
    }

    const account = await tx.customerAccount.findUnique({
      where: { id: accountId },
      select: { id: true, customerGroupId: true },
    });

    if (!account || account.customerGroupId !== groupId) {
      throw new BadRequestException({
        message: 'That organisation is not linked to your account.',
        details: { code: 'ACCOUNT_NOT_IN_GROUP' },
      });
    }

    // Belonging to the company is not the same as being one this user may act for.
    // Without this, a user restricted to one organisation could still file a quote
    // against another of their company's organisations.
    const { accountIds } = this.context.require();
    if (accountIds.length > 0 && !accountIds.includes(account.id)) {
      throw new BadRequestException({
        message: 'You do not have access to that organisation.',
        details: { code: 'ACCOUNT_NOT_PERMITTED' },
      });
    }

    return account.id;
  }

  /**
   * Which organisation a request belongs to when the customer did not say.
   *
   * It matters more than it looks: the account carries the CargoWise organisation
   * code, and the copy we hand over is filed against it. A request with no account
   * went out with an empty code and could not be filed at the far end. The account
   * also carries the servicing branch that decides which queue the request lands in.
   *
   * Only ever infers when there is exactly one answer. With several it stays null
   * rather than guessing - filing a request against the wrong legal entity is worse
   * than filing it against none.
   */
  private async inferAccountId(
    tx: Parameters<Parameters<TenantRepository['run']>[0]>[0],
    groupId: string,
  ): Promise<string | null> {
    const { accountIds } = this.context.require();

    // A user scoped to one organisation has already answered the question.
    if (accountIds.length === 1) {
      return accountIds[0] ?? null;
    }

    if (accountIds.length > 1) {
      return null;
    }

    // Unscoped user: fall back to the company's own single organisation.
    const accounts = await tx.customerAccount.findMany({
      where: { customerGroupId: groupId, isActive: true },
      select: { id: true },
      take: 2,
    });

    return accounts.length === 1 ? (accounts[0]?.id ?? null) : null;
  }

  /**
   * Synchronous rating. A provider failure is a quote state, not an HTTP error - the
   * user keeps their draft and can retry.
   *
   * It does NOT set a status. `rated` and `rate_failed` are retired: the machine forbids
   * anything moving into them, and writing one here would have let this route overwrite
   * an accepted quote's status and wipe an agreed price. A rated draft is still a draft,
   * and the customer still has to submit it.
   */
  async rate(id: string): Promise<QuoteRateResultDto> {
    // Customer route, so an internal session is refused here as it is on every other
    // method: staff read through RLS, and this one WRITES, so without the refusal a
    // custom internal role holding quotes.create could rate another tenant's draft.
    this.requireCustomer();

    // There is no configured rate source (v4 rule 1); every quote is priced by a
    // person. The switch is the control that keeps this path closed, so it is
    // checked before the adapter is touched rather than left to the stub.
    if (!(await this.switches.isEnabled('quotations.instant_rate'))) {
      throw new ForbiddenException({
        message: 'Instant rating is not available.',
        details: { code: 'INSTANT_RATE_UNAVAILABLE' },
      });
    }

    // Read the row directly rather than through getById: this needs the account and
    // the raw figures, which the customer projection deliberately does not carry.
    const quote = await this.repo.run((tx) =>
      tx.quote.findUnique({
        where: { id },
        select: {
          status: true,
          accountId: true,
          mode: true,
          originCode: true,
          destinationCode: true,
          grossWeightKg: true,
          chargeableKg: true,
          currency: true,
          account: { select: { cw1OrgCode: true } },
        },
      }),
    );

    if (!quote) {
      throw new NotFoundException('Quote not found.');
    }

    if (quote.status !== 'draft') {
      throw new ConflictException({
        message: 'Only a draft can be rated.',
        details: { code: 'QUOTE_NOT_DRAFT', status: quote.status },
      });
    }

    try {
      const result = await this.rateEngine.rate({
        mode: quote.mode,
        originCode: quote.originCode,
        destinationCode: quote.destinationCode,
        grossWeightKg: Number(quote.grossWeightKg ?? 0),
        chargeableKg: Number(quote.chargeableKg ?? 0),
        currency: quote.currency ?? 'EUR',
        cw1OrgCode: quote.account?.cw1OrgCode ?? '',
      });

      // Conditional on the status that was read, because the check above and this
      // write would otherwise sit in two transactions: a quote submitted in between
      // would have its figures overwritten after it left the customer's hands.
      const rated = await this.repo.run((tx) =>
        tx.quote.updateMany({
          where: { id, status: 'draft' },
          data: {
            rateResponse: result.raw as object,
            totalMinorUnits: result.totalMinorUnits,
            currency: result.currency,
            validUntil: result.validUntil,
          },
        }),
      );

      if (rated.count === 0) {
        throw new ConflictException({
          message: 'This quote was sent while it was being rated.',
          details: { code: 'QUOTE_NOT_DRAFT' },
        });
      }

      // Its own small shape. Returning the customer projection would be wrong here:
      // that projection nulls every figure until publication, so an instant rate would
      // come back with no rate in it. It also never carries `rateResponse`, which this
      // method has just written and which is not the customer's to read.
      return {
        id,
        totalMinorUnits: Number(result.totalMinorUnits),
        currency: result.currency,
        validUntil: result.validUntil.toISOString(),
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      this.logger.warn({ err: error, quoteId: id }, 'Rating failed');

      // No status change, and nothing recorded on the quote: a provider that did not
      // answer has told us nothing worth storing. The draft is untouched and retryable.
      throw new ServiceUnavailableException({
        message: 'Rating is unavailable. Your request has been kept as a draft.',
        details: { code: 'RATE_UNAVAILABLE' },
      });
    }
  }

  /**
   * Per-tenant sequential reference, e.g. Q-000042. Unique per group, not globally.
   *
   * Allocated by a SECURITY DEFINER function that takes a row lock on the group's counter,
   * so two simultaneous creates queue rather than both reading the same number. The old
   * implementation was `count(*) + 1`, which collided under load and also recycled the
   * reference of any deleted quote.
   */
  private async nextReference(
    tx: Parameters<Parameters<TenantRepository['run']>[0]>[0],
    groupId: string,
  ): Promise<string> {
    const rows = await tx.$queryRaw<
      Array<{ next_quote_reference: string }>
    >`SELECT app.next_quote_reference(${groupId}::uuid) AS next_quote_reference`;

    const reference = rows[0]?.next_quote_reference;

    if (!reference) {
      throw new Error('Quote reference allocation returned no value.');
    }

    return reference;
  }
}

/**
 * Package lines live in the quote payload rather than a table, so they come back
 * as unshaped JSON. Anything that is not a usable line is dropped rather than
 * passed on half-formed - a malformed line in an outbound message is harder to
 * diagnose at the far end than a missing one.
 */
function asPackageArray(value: unknown): TmsQuotePackage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];

    const line = entry as Record<string, unknown>;
    const quantity = Number(line.quantity);
    const weightKg = Number(line.weightKg);

    if (!Number.isFinite(quantity) || !Number.isFinite(weightKg)) return [];

    const dimension = (key: string) => {
      const parsed = Number(line[key]);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return [{
      quantity,
      packageType: typeof line.packageType === 'string' ? line.packageType : '',
      lengthCm: dimension('lengthCm'),
      widthCm: dimension('widthCm'),
      heightCm: dimension('heightCm'),
      weightKg,
      description: typeof line.description === 'string' ? line.description : null,
    }];
  });
}
