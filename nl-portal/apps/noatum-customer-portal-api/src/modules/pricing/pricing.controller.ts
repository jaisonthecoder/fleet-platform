import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import {
  ClaimResultDto,
  DecisionResultDto,
  ForceReleaseDto,
  PERMISSIONS,
  PriceQuoteDto,
  PriceResultDto,
  PricingQuotationListDto,
  PricingQueueEntryDto,
  PricingQuoteDto,
  PublishResultDto,
  SendBackDto,
} from '../../contracts';

import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PricingAssistDto, PricingAssistRequestDto, assistSchema } from '../ai-intake/pricing/ai-pricing.dto';

import { PricingService } from './pricing.service';

/**
 * The internal pricing queue. Every route here is staff-only, enforced by the
 * permission guard and again by `runInternal` in the service - the second check is
 * not redundant, it is what makes a mistake in role seeding fail loudly.
 */
@ApiTags('pricing')
@ApiBearerAuth()
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @RequirePermission(PERMISSIONS.PRICING_QUEUE_READ)
  @Get('queue')
  @ApiOkResponse({ type: [PricingQueueEntryDto] })
  queue() {
    return this.pricing.queue();
  }

  /**
   * The branch's quotations, paged. The queue above is the work list; this is the
   * record. Same permission: both answer "what has this branch quoted".
   */
  @RequirePermission(PERMISSIONS.PRICING_QUEUE_READ)
  @Get('quotations')
  @ApiOkResponse({ type: PricingQuotationListDto })
  quotations(
    @Query('search') search?: string,
    /** One of QUOTE_PIPELINE_SEGMENTS. What the pipeline band filters on. */
    @Query('segment') segment?: string,
    /** A saved view: `unclaimed`, `mine` or `expiring`. Independent of the segment. */
    @Query('view') view?: string,
    /** Transport mode. One of TRANSPORT_MODES; anything else is ignored. */
    @Query('mode') mode?: string,
    /** When the request was raised. ISO dates, inclusive at both ends. */
    @Query('requestedFrom') requestedFrom?: string,
    @Query('requestedTo') requestedTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.pricing.quotations({
      search,
      segment,
      view,
      mode,
      requestedFrom,
      requestedTo,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @RequirePermission(PERMISSIONS.PRICING_QUEUE_READ)
  @Get('quotes/:id')
  @ApiOkResponse({ type: PricingQuoteDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.detail(id);
  }

  @RequirePermission(PERMISSIONS.PRICING_CLAIM)
  @Post('quotes/:id/claim')
  @ApiOkResponse({ type: ClaimResultDto })
  claim(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.claim(id);
  }

  @RequirePermission(PERMISSIONS.PRICING_CLAIM)
  @Post('quotes/:id/release')
  release(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.release(id);
  }

  /**
   * Taking someone else's claim. Separate route and separate permission from
   * `release`, because "give mine back" and "take theirs" are different acts and
   * only one of them needs a reason.
   */
  @RequirePermission(PERMISSIONS.PRICING_CLAIM_RELEASE)
  @Post('quotes/:id/force-release')
  @ApiBody({ type: ForceReleaseDto })
  forceRelease(@Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.pricing.forceRelease(id, body?.reason ?? '');
  }

  /**
   * Validated against the zod schema inside the service, so the SPA and the API agree.
   *
   * The feature guard is on this route and not on claim, release or the queue:
   * recording a price is the optional capability, whereas who is handling a request
   * matters just as much when the price is coming from CargoWise.
   */
  @RequirePermission(PERMISSIONS.PRICING_PRICE)
  @RequireFeature('quotations.portal_pricing')
  @Post('quotes/:id/price')
  @ApiBody({ type: PriceQuoteDto })
  @ApiOkResponse({ type: PriceResultDto })
  price(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.pricing.price(id, body);
  }

  /**
   * The pricing assistant. Drafts only: it writes nothing and publishes nothing.
   *
   * It sits on the pricing controller rather than under /api/ai so it inherits the
   * branch scope this controller's service already enforces. `pricing.price` is the
   * permission because everything it produces is an edit to a price a pricer is
   * about to make.
   */
  @RequirePermission(PERMISSIONS.PRICING_PRICE)
  @RequireFeature('pricing.ai_assist')
  @Post('quotes/:id/assist')
  @ApiBody({ type: PricingAssistRequestDto })
  @ApiOkResponse({ type: PricingAssistDto })
  assist(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    // Same shape as the other controllers': the first issue is the message.
    const parsed = assistSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid request.');
    }
    return this.pricing.assist(id, parsed.data, parsed.data.locale);
  }

  /** The approver may never be the pricer; the service refuses, not the screen. */
  @RequirePermission(PERMISSIONS.PRICING_APPROVE)
  @Post('quotes/:id/approve')
  @ApiOkResponse({ type: DecisionResultDto })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.approve(id);
  }

  @RequirePermission(PERMISSIONS.PRICING_APPROVE)
  @Post('quotes/:id/send-back')
  @ApiBody({ type: SendBackDto })
  @ApiOkResponse({ type: DecisionResultDto })
  sendBack(@Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.pricing.sendBack(id, body?.reason ?? '');
  }

  /** The act that makes any of this visible to a customer. */
  @RequirePermission(PERMISSIONS.PRICING_PUBLISH)
  @Post('quotes/:id/publish')
  @ApiOkResponse({ type: PublishResultDto })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.publish(id);
  }
}
