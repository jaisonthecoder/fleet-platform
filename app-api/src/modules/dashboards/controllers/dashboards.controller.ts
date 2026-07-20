import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import { DashboardsService } from '../services/dashboards.service';

/**
 * Read-model surface (M9). All routes require authentication; the dashboard
 * tiles additionally apply cost masking from the caller's roles (Finance full ·
 * Executive aggregate · others masked). Everything is scope-filterable via
 * `?scopeId=<hierarchy node uuid>` (roll-up over the subtree).
 */
@Controller({ version: '1' })
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  /** GET /api/v1/operations/overview — the real operations read model (mock retired). */
  @Get('operations/overview')
  overview(@CurrentUser() principal: Principal, @Query('scopeId') scopeId?: string) {
    return this.dashboards.operationsOverview(principal, scopeId);
  }

  /** GET /api/v1/dashboards/utilisation — utilisation KPI over the scope. */
  @Get('dashboards/utilisation')
  utilisation(@CurrentUser() principal: Principal, @Query('scopeId') scopeId?: string) {
    return this.dashboards.utilisation(principal, scopeId);
  }

  /** GET /api/v1/dashboards/fines-per-user — cost-masked per the caller's roles. */
  @Get('dashboards/fines-per-user')
  finesPerUser(@CurrentUser() principal: Principal, @Query('scopeId') scopeId?: string) {
    const roles = principal.roles.map((r) => r.role);
    return this.dashboards.finesPerUser(principal, roles, scopeId);
  }

  /** GET /api/v1/dashboards/compliance-heat-map — compliance status counts + blocks. */
  @Get('dashboards/compliance-heat-map')
  complianceHeatMap(@CurrentUser() principal: Principal, @Query('scopeId') scopeId?: string) {
    return this.dashboards.complianceHeatMap(principal, scopeId);
  }

  /** GET /api/v1/dashboards/entitlement-inventory — dedicated allocations over the scope. */
  @Get('dashboards/entitlement-inventory')
  entitlementInventory(@CurrentUser() principal: Principal, @Query('scopeId') scopeId?: string) {
    return this.dashboards.entitlementInventory(principal, scopeId);
  }

  /** GET /api/v1/dashboards/telematics-coverage — devices reporting vs the fleet. */
  @Get('dashboards/telematics-coverage')
  telematicsCoverage(@CurrentUser() principal: Principal, @Query('scopeId') scopeId?: string) {
    return this.dashboards.telematicsCoverage(principal, scopeId);
  }
}
