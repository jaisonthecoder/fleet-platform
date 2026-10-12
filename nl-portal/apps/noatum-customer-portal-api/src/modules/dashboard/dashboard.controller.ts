import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  DASHBOARD_MODES,
  DASHBOARD_PERIODS,
  DashboardAnalyticsDto,
  PERMISSIONS,
  dashboardQuerySchema,
} from '../../contracts';

import { DashboardService } from './dashboard.service';

/**
 * The customer's own dashboard.
 *
 * One route, because the screen asks one question. Behind `dashboard.analytics`
 * as well as `dashboard.read`: the figures are a sample on a pilot environment,
 * and a switch is what lets an operator take the whole screen away rather than
 * relying on every panel to caveat itself.
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('analytics')
  @RequirePermission(PERMISSIONS.DASHBOARD_READ)
  @RequireFeature('dashboard.analytics')
  // The figures move as shipments do, and a cached dashboard that disagrees
  // with the shipment list is worse than one that costs a request.
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'period', required: false, enum: DASHBOARD_PERIODS })
  @ApiQuery({ name: 'mode', required: false, enum: DASHBOARD_MODES })
  @ApiOkResponse({ type: DashboardAnalyticsDto })
  analytics(
    @Query('period') period?: string,
    @Query('mode') mode?: string,
  ): Promise<DashboardAnalyticsDto> {
    // Parsed rather than trusted: an unknown period or mode falls back to the
    // default instead of reaching the sample generator as a cache key nobody
    // wrote. The schema owns the defaults so the SPA and the server agree.
    const query = dashboardQuerySchema.parse({
      period: period ?? undefined,
      mode: mode ?? undefined,
    });
    return this.dashboard.analytics(query);
  }
}
