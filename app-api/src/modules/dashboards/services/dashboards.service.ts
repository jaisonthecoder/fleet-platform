import { BadRequestException, Injectable } from '@nestjs/common';
import type { PlatformRole } from '../../../common/database/schema';
import type { Principal } from '../../../common/auth/principal';
import type {
  ComplianceHeatMapTile,
  EntitlementInventoryTile,
  FinesPerUserTile,
  TelematicsCoverageTile,
  UtilisationTile,
} from '../../../contracts/dashboards.contract';
import type { OperationsOverview } from '../../../contracts/operations-overview.contract';
import { HierarchyService } from '../../platform/services/hierarchy.service';
import { costVisibility, maskFinesTile } from '../internal/cost-masking';
import { DashboardsRepository } from '../repositories/dashboards.repository';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pct = (numerator: number, denominator: number): number =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

/** [start-of-today, start-of-tomorrow) in UTC. */
function todayUtc(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Role- and scope-aware read models (M9). Aggregates committed state only —
 * never decides — and enforces cost masking server-side. Retires the Phase-0
 * `operations` mock: `operationsOverview()` now serves real data.
 */
@Injectable()
export class DashboardsService {
  constructor(
    private readonly repo: DashboardsRepository,
    private readonly hierarchy: HierarchyService,
  ) {}

  private async resolveScope(principal: Principal, requestedScopeId?: string): Promise<{ nodeIds: string[] | null; vehicleIds: string[] | null; scopeId?: string }> {
    if (requestedScopeId && !UUID_RE.test(requestedScopeId)) {
      throw new BadRequestException({
        title: 'Invalid dashboard scope',
        reasons: [`invalid-hierarchy-scope:${requestedScopeId}`],
      });
    }
    const scopeId = await this.hierarchy.resolveAuthorizedScope(
      principal,
      requestedScopeId,
    );
    if (!scopeId) {
      return { nodeIds: null, vehicleIds: null };
    }
    const nodeIds = await this.hierarchy.scopeSubtree(
      scopeId,
      principal.organizationId,
    );
    if (nodeIds.length === 0) {
      return { nodeIds: [], vehicleIds: [], scopeId };
    }
    return { nodeIds, vehicleIds: await this.repo.vehicleIdsInNodes(nodeIds), scopeId };
  }

  /** The real operations overview read model (replaces the Phase-0 mock). */
  async operationsOverview(principal: Principal, requestedScopeId?: string): Promise<OperationsOverview> {
    const { vehicleIds, scopeId } = await this.resolveScope(principal, requestedScopeId);
    const total = await this.repo.countVehicles(vehicleIds);
    const unavailable = await this.repo.countUnavailableVehicles(vehicleIds);
    const inUse = await this.repo.countVehiclesWithBookingStatus(vehicleIds, ['Active']);
    const reserved = await this.repo.countVehiclesWithBookingStatus(vehicleIds, ['PendingApproval', 'Approved']);
    const available = Math.max(total - unavailable - inUse - reserved, 0);
    const { start, end } = todayUtc();
    const bookingsToday = await this.repo.countBookingsInWindow(vehicleIds, start, end);
    const activeBookings = await this.repo.countVehiclesWithBookingStatus(vehicleIds, ['Active']);
    const compliance = await this.repo.complianceCounts(vehicleIds);
    const activeBlocks = await this.repo.countActiveBlocks();
    const complianceAttentionCount = compliance.expiringSoon + compliance.expired + activeBlocks;

    const expiring = await this.repo.expiringItems(vehicleIds, 5);
    const attentionItems: OperationsOverview['attentionItems'] = [];
    for (const item of expiring) {
      const plate = await this.repo.plateOf(item.subjectRef);
      attentionItems.push({
        id: item.id,
        level: item.status === 'Expired' ? 'danger' : 'warning',
        title: `${item.itemType} ${item.status === 'Expired' ? 'expired' : 'expiring soon'}`,
        detail: `${plate}${item.expiryDate ? ` · ${item.expiryDate}` : ''}`,
        action: 'Review vehicle',
      });
    }
    if (activeBlocks > 0) {
      attentionItems.push({ id: 'access-blocks', level: 'danger', title: `${activeBlocks} active access block(s)`, detail: 'Drivers blocked platform-wide', action: 'Review blocks' });
    }

    const upcoming = await this.repo.upcomingBookings(vehicleIds, 5);
    const upcomingBookings: OperationsOverview['upcomingBookings'] = [];
    for (const b of upcoming) {
      const plate = await this.repo.plateOf(b.vehicleId);
      upcomingBookings.push({
        id: b.id,
        time: b.pickupAtUtc.toISOString().slice(11, 16),
        route: b.destination ?? 'Trip',
        plate,
        status: b.status === 'Approved' ? 'Ready' : 'Pending',
      });
    }

    return {
      scope: { id: scopeId ?? 'all', label: scopeId ? 'Scoped view' : 'All pools' },
      generatedAt: new Date().toISOString(),
      summary: {
        availableVehicles: available,
        totalVehicles: total,
        bookingsToday,
        activeBookings,
        attentionCount: attentionItems.length,
        complianceAttentionCount,
        utilizationPercent: pct(inUse + reserved, total),
        utilizationChangePercent: 0,
      },
      availability: { available, inUse, reserved, unavailable },
      attentionItems,
      upcomingBookings,
    };
  }

  async utilisation(principal: Principal, requestedScopeId?: string): Promise<UtilisationTile> {
    const { vehicleIds, scopeId } = await this.resolveScope(principal, requestedScopeId);
    const totalVehicles = await this.repo.countVehicles(vehicleIds);
    const unavailable = await this.repo.countUnavailableVehicles(vehicleIds);
    const activeBookings = await this.repo.countVehiclesWithBookingStatus(vehicleIds, ['Active']);
    const reserved = await this.repo.countVehiclesWithBookingStatus(vehicleIds, ['PendingApproval', 'Approved']);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const bookingsLast30d = await this.repo.countBookingsInWindow(vehicleIds, thirtyDaysAgo, new Date());
    return {
      scopeId: scopeId ?? null,
      totalVehicles,
      bookableVehicles: Math.max(totalVehicles - unavailable, 0),
      activeBookings,
      bookingsLast30d,
      utilizationPercent: pct(activeBookings + reserved, totalVehicles),
    };
  }

  /** Fines-per-user with server-side cost masking by the caller's roles. */
  async finesPerUser(principal: Principal, roles: readonly PlatformRole[], requestedScopeId?: string): Promise<FinesPerUserTile> {
    const { vehicleIds } = await this.resolveScope(principal, requestedScopeId);
    const perUser = await this.repo.finesPerUser(vehicleIds);
    const totalFines = perUser.reduce((sum, r) => sum + r.fineCount, 0);
    const totalAmount = perUser.reduce((sum, r) => sum + Number(r.totalAmount), 0).toFixed(2);
    return maskFinesTile(costVisibility(roles), { totalFines, totalAmount, perUser });
  }

  async complianceHeatMap(principal: Principal, requestedScopeId?: string): Promise<ComplianceHeatMapTile> {
    const { vehicleIds } = await this.resolveScope(principal, requestedScopeId);
    const counts = await this.repo.complianceCounts(vehicleIds);
    const activeBlocks = await this.repo.countActiveBlocks();
    return { ...counts, activeBlocks };
  }

  async entitlementInventory(principal: Principal, requestedScopeId?: string): Promise<EntitlementInventoryTile> {
    const { nodeIds } = await this.resolveScope(principal, requestedScopeId);
    return this.repo.entitlementInventory(nodeIds);
  }

  async telematicsCoverage(principal: Principal, requestedScopeId?: string): Promise<TelematicsCoverageTile> {
    const { vehicleIds } = await this.resolveScope(principal, requestedScopeId);
    const fleetInScope = await this.repo.countVehicles(vehicleIds);
    const devicesReporting = await this.repo.devicesReporting(vehicleIds);
    return { fleetInScope, devicesReporting, coveragePercent: pct(devicesReporting, fleetInScope) };
  }
}
