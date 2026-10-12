import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AcceptQuoteDto,
  CreateQuoteDto,
  CustomerQuoteDto,
  CustomerQuoteListDto,
  DeclineQuoteDto,
  PERMISSIONS,
  QuoteCreatedDto,
  QuoteInsightsDto,
  QuoteRateResultDto,
  QuoteStatusResultDto,
} from '../../contracts';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';

import { QuoteInsightsService } from './quote-insights.service';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth()
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly insights: QuoteInsightsService,
  ) {}

  /**
   * What the quotations landing page reports.
   *
   * Before the :id route, or Nest reads "insights" as a quote id and the UUID
   * pipe rejects it.
   */
  @RequirePermission(PERMISSIONS.QUOTES_READ)
  @Get('insights')
  @ApiOkResponse({ type: QuoteInsightsDto })
  quoteInsights(): Promise<QuoteInsightsDto> {
    return this.insights.insights();
  }

  @RequirePermission(PERMISSIONS.QUOTES_READ)
  @Get()
  @ApiOkResponse({ type: CustomerQuoteListDto })
  list(
    @Query('search') search?: string,
    @Query('badge') badge?: string,
    /** One of QUOTE_PIPELINE_SEGMENTS. What the pipeline band filters on. */
    @Query('segment') segment?: string,
    /** A saved view: `needs_decision` or `accepted`. Independent of the segment. */
    @Query('view') view?: string,
    /** Transport mode. One of TRANSPORT_MODES; anything else is ignored. */
    @Query('mode') mode?: string,
    /** When the request was raised. ISO dates, inclusive at both ends. */
    @Query('requestedFrom') requestedFrom?: string,
    @Query('requestedTo') requestedTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.quotes.list({
      search,
      badge,
      segment,
      view,
      mode,
      requestedFrom,
      requestedTo,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @RequirePermission(PERMISSIONS.QUOTES_READ)
  @Get(':id')
  @ApiOkResponse({ type: CustomerQuoteDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.getById(id);
  }

  @RequirePermission(PERMISSIONS.QUOTES_CREATE)
  @Post()
  @ApiBody({ type: CreateQuoteDto })
  @ApiCreatedResponse({ type: QuoteCreatedDto })
  create(@Body() body: unknown) {
    // Validated against the zod schema in @/contracts inside the service, so
    // the API and the SPA reject exactly the same payloads.
    return this.quotes.create(body);
  }

  @RequirePermission(PERMISSIONS.QUOTES_CREATE)
  @Post(':id/rate')
  @ApiOkResponse({ type: QuoteRateResultDto })
  rate(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.rate(id);
  }

  /** Sends a draft to the pricing queue of the servicing branch. */
  @RequirePermission(PERMISSIONS.QUOTES_SUBMIT)
  @Post(':id/submit')
  @ApiOkResponse({ type: QuoteStatusResultDto })
  submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.submit(id);
  }

  @RequirePermission(PERMISSIONS.QUOTES_ACCEPT)
  @Post(':id/accept')
  @ApiBody({ type: AcceptQuoteDto })
  @ApiOkResponse({ type: QuoteStatusResultDto })
  accept(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.quotes.accept(id, body);
  }

  @RequirePermission(PERMISSIONS.QUOTES_ACCEPT)
  @Post(':id/decline')
  @ApiBody({ type: DeclineQuoteDto })
  @ApiOkResponse({ type: QuoteStatusResultDto })
  decline(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.quotes.decline(id, body);
  }

  @RequirePermission(PERMISSIONS.QUOTES_CANCEL)
  @Post(':id/cancel')
  @ApiOkResponse({ type: QuoteStatusResultDto })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.cancel(id);
  }
}
