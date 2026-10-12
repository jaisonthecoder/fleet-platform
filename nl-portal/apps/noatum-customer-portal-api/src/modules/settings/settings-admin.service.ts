import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';

import {
  SETTINGS,
  SETTING_KEYS,
  SETTING_SCOPES,
  isSettingKey,
  parseSettingValue,
  settingDefinition,
  type SettingKey,
  type SettingScope,
} from '../../contracts';

import { SettingsService, type ResolvedSetting } from '../../common/settings/settings.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { TenantRepository, type TenantClient } from '../../common/tenancy/tenant.repository';

const setSettingSchema = z.object({
  scope: z.enum(SETTING_SCOPES),
  /** Null for global; a region code, branch code or customer group id otherwise. */
  scopeId: z.string().trim().min(1).max(64).nullish(),
  value: z.unknown(),
  /** Mandatory. The change log is the feature, and a blank reason makes it worthless. */
  reason: z.string().trim().min(3).max(400),
});

export interface SettingRow {
  key: SettingKey;
  group: string;
  type: string;
  label: string;
  description: string;
  unit: string | null;
  options: readonly { value: string; label: string }[] | null;
  min: number | null;
  max: number | null;
  defaultValue: boolean | number | string;
  requiresSwitch: string | null;
  /** What this scope actually gets, and which layer supplied it. */
  effective: ResolvedSetting;
  /** Every stored override for this key, so the screen can show the whole ladder. */
  overrides: {
    scope: SettingScope;
    scopeId: string | null;
    value: unknown;
    valid: boolean;
    reason: string;
    updatedBy: string | null;
    updatedAt: string;
  }[];
}

/**
 * Reading and changing scoped settings. ADR-010.
 *
 * The resolver alone was not a feature: for one slice the catalogue, the table and
 * the RLS existed while no administrator could change anything, so every value sat
 * at its code default and the mockup's pilot-branch override was impossible. This
 * module is the half that was missing.
 */
@Injectable()
export class SettingsAdminService {
  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
    private readonly settings: SettingsService,
  ) {}

  /**
   * The whole catalogue, with each key's effective value for a chosen scope and
   * every override beneath it.
   *
   * The scope is supplied by the caller rather than taken from the acting user: an
   * administrator in Madrid has to be able to see what Valencia gets, and reading
   * their own scope would quietly show them the wrong answer.
   */
  async list(scope: {
    regionCode?: string | null;
    branchCode?: string | null;
    customerGroupId?: string | null;
  }): Promise<SettingRow[]> {
    this.requireInternal();

    const [effective, stored] = await Promise.all([
      this.settings.resolveAll(scope),
      this.repo.runInternal((tx) =>
        tx.settingValue.findMany({
          orderBy: [{ key: 'asc' }, { scope: 'asc' }],
          include: { updatedBy: { select: { displayName: true } } },
        }),
      ),
    ]);

    const byKey = new Map(effective.map((entry) => [entry.key, entry]));

    return SETTING_KEYS.map((key) => {
      const definition = settingDefinition(key);

      return {
        key,
        group: definition.group,
        type: definition.type,
        label: definition.label,
        description: definition.description,
        unit: definition.type === 'number' ? definition.unit : null,
        options: definition.type === 'enum' ? definition.options : null,
        min: definition.type === 'number' ? definition.min : null,
        max: definition.type === 'number' ? definition.max : null,
        defaultValue: definition.defaultValue,
        requiresSwitch: definition.requiresSwitch ?? null,
        effective: byKey.get(key)!,
        overrides: stored
          .filter((row) => row.key === key)
          .map((row) => ({
            scope: row.scope,
            scopeId: row.scopeId,
            value: row.value,
            // Surfaced rather than hidden: a row the resolver is skipping because it
            // no longer fits the catalogue must be visible to whoever can fix it.
            valid: this.isValid(key, row.value),
            reason: row.reason,
            updatedBy: row.updatedBy?.displayName ?? null,
            updatedAt: row.updatedAt.toISOString(),
          })),
      };
    });
  }

  /** The change log, newest first. Audit rows, not a second store. */
  async history(take = 50) {
    this.requireInternal();

    return this.repo.runInternal((tx) =>
      tx.auditEvent.findMany({
        where: { entityType: 'setting' },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(take, 1), 200),
      }),
    );
  }

  /**
   * Sets a value at one layer.
   *
   * Upsert rather than insert, because an administrator correcting yesterday's
   * threshold is doing the same thing they did yesterday, and making them delete
   * first would leave a window where the branch silently inherits the global.
   */
  async set(key: string, body: unknown): Promise<ResolvedSetting> {
    const actor = this.requireInternal();

    if (!isSettingKey(key)) {
      throw new NotFoundException(`No setting named ${key}.`);
    }

    const parsed = setSettingSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const { scope, reason } = parsed.data;
    const scopeId = parsed.data.scopeId ?? null;

    // The table has a CHECK for this too. Refusing here as well turns a constraint
    // violation into a sentence somebody can act on.
    if (scope === 'global' && scopeId !== null) {
      throw new BadRequestException('A global setting has no scope id.');
    }

    if (scope !== 'global' && scopeId === null) {
      throw new BadRequestException(`A ${scope} setting needs a ${scope} to apply to.`);
    }

    let value: boolean | number | string;

    try {
      value = parseSettingValue(key, parsed.data.value);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    await this.repo.runInternal(async (tx) => {
      const before = await tx.settingValue.findFirst({ where: { key, scope, scopeId } });

      if (before === null) {
        await tx.settingValue.create({
          data: { key, scope, scopeId, value: value as never, reason, updatedById: actor.userId },
        });
      } else {
        await tx.settingValue.update({
          where: { id: before.id },
          data: { value: value as never, reason, updatedById: actor.userId },
        });
      }

      await this.audit(tx, key, 'setting.changed', {
        scope,
        scopeId,
        before: before?.value ?? null,
        after: value,
        reason,
      });
    });

    return this.settings.resolve(key, this.scopeFor(scope, scopeId));
  }

  /** Removes an override so the layer below it applies again. */
  async clear(key: string, scope: SettingScope, scopeId: string | null, reason: string) {
    this.requireInternal();

    if (!isSettingKey(key)) {
      throw new NotFoundException(`No setting named ${key}.`);
    }

    if (reason.trim().length < 3) {
      throw new BadRequestException('Removing an override needs a reason.');
    }

    await this.repo.runInternal(async (tx) => {
      const existing = await tx.settingValue.findFirst({ where: { key, scope, scopeId } });

      if (existing === null) {
        throw new NotFoundException('No override at that scope.');
      }

      await tx.settingValue.delete({ where: { id: existing.id } });

      await this.audit(tx, key, 'setting.cleared', {
        scope,
        scopeId,
        before: existing.value,
        after: null,
        reason,
      });
    });

    return this.settings.resolve(key, this.scopeFor(scope, scopeId));
  }

  private scopeFor(scope: SettingScope, scopeId: string | null) {
    return {
      regionCode: scope === 'region' ? scopeId : null,
      branchCode: scope === 'branch' ? scopeId : null,
      customerGroupId: scope === 'customer' ? scopeId : null,
    };
  }

  private isValid(key: SettingKey, value: unknown): boolean {
    try {
      parseSettingValue(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private async audit(
    tx: TenantClient,
    key: string,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const actor = this.context.require();

    await tx.auditEvent.create({
      data: {
        actorUserId: actor.userId,
        action,
        entityType: 'setting',
        entityId: key,
        metadata: metadata as never,
      },
    });
  }

  private requireInternal() {
    const actor = this.context.require();

    if (!actor.isInternal) {
      throw new ForbiddenException('Platform settings are internal to Noatum.');
    }

    return actor;
  }
}

export const SETTING_CATALOGUE_SIZE = Object.keys(SETTINGS).length;
