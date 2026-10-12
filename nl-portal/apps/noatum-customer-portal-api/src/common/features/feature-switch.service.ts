import { Injectable } from '@nestjs/common';
// Relative, not `@/contracts`: these are values, and the path alias is not
// rewritten in the CommonJS build.
import {
  FEATURE_SWITCHES,
  FEATURE_SWITCH_KEYS,
  isFeatureSwitchKey,
  type FeatureSwitchKey,
} from '../../contracts/feature-switches';

import { PrismaService } from '../tenancy/prisma.service';

export interface EffectiveSwitch {
  key: FeatureSwitchKey;
  enabled: boolean;
  /** False while the switch still sits at its code default. */
  overridden: boolean;
  approvalReference: string | null;
  reason: string | null;
  updatedById: string | null;
  updatedAt: string | null;
}

/**
 * Resolves feature switch state.
 *
 * Reads go through PrismaService rather than TenantRepository because the read
 * policy is open and a gated route may have no tenant in scope. Writes are
 * internal-only and belong to the features module.
 *
 * No cache in Phase 1, per simplification A1: this is a single indexed read of a
 * table with fewer rows than the catalogue has entries. Add one behind this
 * service if a measured p95 ever asks for it.
 */
@Injectable()
export class FeatureSwitchService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(key: FeatureSwitchKey): Promise<boolean> {
    const row = await this.prisma.featureSwitch.findUnique({ where: { key } });
    return row ? row.isEnabled : FEATURE_SWITCHES[key].defaultEnabled;
  }

  /** Every catalogue entry with its effective state, stored rows merged in. */
  async all(): Promise<EffectiveSwitch[]> {
    const rows = await this.prisma.featureSwitch.findMany();
    // Keyed on the catalogue, so a stored row whose key has been retired is ignored.
    const stored = new Map(rows.filter((row) => isFeatureSwitchKey(row.key)).map((row) => [row.key, row]));

    return FEATURE_SWITCH_KEYS.map((key) => {
      const row = stored.get(key);
      return {
        key,
        enabled: row ? row.isEnabled : FEATURE_SWITCHES[key].defaultEnabled,
        overridden: Boolean(row),
        approvalReference: row?.approvalReference ?? null,
        reason: row?.reason ?? null,
        updatedById: row?.updatedById ?? null,
        updatedAt: row?.updatedAt.toISOString() ?? null,
      };
    });
  }

  /**
   * The keys that are on, for the SPA to hide controls with.
   *
   * The same catalogue and the same stored rows the guard reads, so a screen cannot
   * disagree with the 403 it would get. This is the courtesy; the guard is the control.
   */
  async enabledKeys(): Promise<FeatureSwitchKey[]> {
    const effective = await this.all();
    return effective.filter((entry) => entry.enabled).map((entry) => entry.key);
  }
}
