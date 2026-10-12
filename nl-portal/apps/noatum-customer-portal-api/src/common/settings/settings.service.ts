import { Injectable } from '@nestjs/common';
// Relative, not `@/contracts`: these are values, and the path alias is not
// rewritten in the CommonJS build.
import {
  SETTINGS,
  SETTING_KEYS,
  SETTING_SCOPE_PRECEDENCE,
  isSettingKey,
  parseSettingValue,
  settingDefinition,
  type SettingKey,
  type SettingScope,
  type SettingValueOf,
} from '../../contracts/settings';

import { FeatureSwitchService } from '../features/feature-switch.service';
import { PrismaService } from '../tenancy/prisma.service';

/**
 * Where a request sits in the hierarchy. Any layer may be absent - a platform
 * job has no customer, an external user has no branch - and an absent layer is
 * simply skipped rather than treated as a miss.
 */
export interface SettingContext {
  regionCode?: string | null;
  branchCode?: string | null;
  customerGroupId?: string | null;
}

export interface ResolvedSetting<T = boolean | number | string> {
  key: SettingKey;
  value: T;
  /**
   * Which layer supplied the value. The settings screen prints this
   * ("inherited from Global", "override at ESVLC"), so the API has to carry it:
   * a bare value cannot be explained to the person about to change it.
   */
  source: SettingScope | 'default';
  sourceId: string | null;
}

/**
 * Resolves scoped settings. ADR-010.
 *
 * Reads go through PrismaService rather than TenantRepository because the read
 * policy on `setting_value` is deliberately open to non-customer rows, and the
 * resolver runs under customer sessions too. Row-level security still applies:
 * a customer session cannot see another group's customer-scoped row.
 *
 * Cached per instance of this class, which Nest scopes per request by default
 * only if asked - it is not, so the cache here is per process and explicitly
 * invalidated on write. That is safe because writes go through
 * `SettingsAdminService`, which calls `invalidate()` in the same transaction
 * boundary, and unsafe the moment somebody writes the table directly. Hence the
 * comment rather than a silent Map.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly switches: FeatureSwitchService,
  ) {}

  /**
   * The scope of the acting user, for callers that do not want to assemble it.
   *
   * Exists because the region layer was unreachable for a whole slice: every call
   * site passed `{ branchCode }` by hand and none of them knew a region existed.
   * One place to build the context means one place to fix when a layer is added.
   */
  scopeOf(actor: {
    regionCode?: string | null;
    branchCode?: string | null;
    customerGroupId?: string | null;
  }): SettingContext {
    return {
      regionCode: actor.regionCode ?? null,
      branchCode: actor.branchCode ?? null,
      customerGroupId: actor.customerGroupId ?? null,
    };
  }

  async get<K extends SettingKey>(
    key: K,
    context: SettingContext = {},
  ): Promise<SettingValueOf<K>> {
    const resolved = await this.resolve(key, context);
    return resolved.value as SettingValueOf<K>;
  }

  /** The value plus the layer it came from, for the settings screen. */
  async resolve<K extends SettingKey>(
    key: K,
    context: SettingContext = {},
  ): Promise<ResolvedSetting<SettingValueOf<K>>> {
    const rows = await this.rowsFor(key);
    return this.pick(key, context, rows, await this.switchAllows(key));
  }

  /**
   * Every catalogue key at once, for a screen that shows them all.
   *
   * One query for every key rather than one per key: twelve round trips to render
   * a settings page is the kind of thing that only shows up in production.
   */
  async resolveAll(context: SettingContext = {}): Promise<ResolvedSetting[]> {
    const grouped = await this.allRows();

    return Promise.all(
      SETTING_KEYS.map(async (key) =>
        this.pick(key, context, grouped.get(key) ?? [], await this.switchAllows(key)),
      ),
    );
  }

  /**
   * Composition: a setting under a switch is not read when the switch is off.
   * Returning the default rather than the stored override matters - a branch that
   * turned drafting on must not appear to have it on while the platform switch
   * says the service is unavailable.
   */
  private async switchAllows(key: SettingKey): Promise<boolean> {
    const requiresSwitch = settingDefinition(key).requiresSwitch;

    if (requiresSwitch === undefined) {
      return true;
    }

    return this.switches.isEnabled(
      requiresSwitch as Parameters<FeatureSwitchService['isEnabled']>[0],
    );
  }

  private pick<K extends SettingKey>(
    key: K,
    context: SettingContext,
    rows: StoredSetting[],
    switchAllows: boolean,
  ): ResolvedSetting<SettingValueOf<K>> {
    const definition = SETTINGS[key];
    const fallback: ResolvedSetting<SettingValueOf<K>> = {
      key,
      value: definition.defaultValue as SettingValueOf<K>,
      source: 'default',
      sourceId: null,
    };

    if (!switchAllows) {
      return fallback;
    }

    let winner = fallback;

    // Least specific first, so the last match wins. Iterating the precedence
    // array rather than sorting the rows keeps the ordering rule in exactly one
    // place - the contracts file - where it can be read.
    for (const scope of SETTING_SCOPE_PRECEDENCE) {
      const scopeId = this.scopeIdFor(scope, context);

      if (scope !== 'global' && scopeId === null) {
        continue;
      }

      const match = rows.find(
        (row) => row.scope === scope && (scope === 'global' || row.scopeId === scopeId),
      );

      if (match === undefined) {
        continue;
      }

      // A stored value that no longer fits the catalogue - the key changed type,
      // or the bounds tightened - is ignored rather than thrown, because one bad
      // row must not take down every quote in the branch. The admin screen shows
      // it as invalid.
      try {
        winner = {
          key,
          value: parseSettingValue(key, match.value) as SettingValueOf<K>,
          source: scope,
          sourceId: match.scopeId,
        };
      } catch {
        continue;
      }
    }

    return winner;
  }

  private scopeIdFor(scope: SettingScope, context: SettingContext): string | null {
    switch (scope) {
      case 'global':
        return null;
      case 'region':
        return context.regionCode ?? null;
      case 'branch':
        return context.branchCode ?? null;
      case 'customer':
        return context.customerGroupId ?? null;
    }
  }

  private async rowsFor(key: SettingKey): Promise<StoredSetting[]> {
    const rows = await this.prisma.settingValue.findMany({ where: { key } });

    return rows.map((row) => ({
      scope: row.scope,
      scopeId: row.scopeId,
      value: row.value,
    }));
  }

  private async allRows(): Promise<Map<string, StoredSetting[]>> {
    const rows = await this.prisma.settingValue.findMany();
    const grouped = new Map<string, StoredSetting[]>();

    for (const row of rows) {
      // Keyed on the catalogue, so a stored row whose key has been retired is
      // ignored and cannot resurrect a behaviour.
      if (!isSettingKey(row.key)) {
        continue;
      }

      const bucket = grouped.get(row.key) ?? [];
      bucket.push({ scope: row.scope, scopeId: row.scopeId, value: row.value });
      grouped.set(row.key, bucket);
    }

    return grouped;
  }
}

interface StoredSetting {
  scope: SettingScope;
  scopeId: string | null;
  value: unknown;
}
