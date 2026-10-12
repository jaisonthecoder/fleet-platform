import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  FEATURE_SWITCHES,
  PROTECTED_CAPABILITIES,
  isFeatureSwitchKey,
  type FeatureSwitchKey,
} from '../../contracts/feature-switches';
import { PERMISSIONS } from '../../contracts/permissions';

import { FeatureSwitchService } from '../../common/features/feature-switch.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import type {
  FeatureSwitchDto,
  FeatureSwitchListDto,
  FeatureSwitchUpdate,
} from '../../contracts/dto/feature-switch.dto';
import { FeaturesRepository } from './features.repository';

@Injectable()
export class FeaturesService {
  private readonly logger = new Logger(FeaturesService.name);

  constructor(
    private readonly repository: FeaturesRepository,
    private readonly switches: FeatureSwitchService,
    private readonly context: TenantContext,
  ) {}

  /** Platform-wide capability control, so internal only and never while impersonating. */
  private authorize(write = false) {
    const actor = this.context.require();
    if (!actor.isInternal || !actor.permissions.has(PERMISSIONS.ADMIN_FLAGS_MANAGE)) {
      throw new ForbiddenException('Internal staff permission required.');
    }
    if (write && actor.onBehalfOfUserId) {
      throw new ForbiddenException('Impersonated sessions are read-only.');
    }
    return actor;
  }

  async list(): Promise<FeatureSwitchListDto> {
    this.authorize();
    const effective = await this.switches.all();

    const names = await this.repository.runInternal(async (tx) => {
      const ids = [...new Set(effective.map((entry) => entry.updatedById).filter((id): id is string => Boolean(id)))];
      if (ids.length === 0) return new Map<string, string>();
      const users = await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } });
      return new Map(users.map((user) => [user.id, user.displayName]));
    });

    return {
      switches: effective.map((entry): FeatureSwitchDto => {
        const definition = FEATURE_SWITCHES[entry.key];
        return {
          key: entry.key,
          category: definition.category,
          label: definition.label,
          description: definition.description,
          enabled: entry.enabled,
          defaultEnabled: definition.defaultEnabled,
          overridden: entry.overridden,
          requiresApproval: definition.requiresApproval,
          approvalReference: entry.approvalReference,
          reason: entry.reason,
          updatedBy: entry.updatedById ? (names.get(entry.updatedById) ?? null) : null,
          updatedAt: entry.updatedAt,
        };
      }),
      protected: PROTECTED_CAPABILITIES.map((entry) => ({ ...entry })),
    };
  }

  async update(key: string, input: FeatureSwitchUpdate): Promise<FeatureSwitchDto> {
    const actor = this.authorize(true);
    if (!isFeatureSwitchKey(key)) throw new NotFoundException('Unknown feature switch.');

    const definition = FEATURE_SWITCHES[key as FeatureSwitchKey];
    // The catalogue, not the caller, decides which switches carry an approval.
    if (input.enabled && definition.requiresApproval && !input.approvalReference) {
      throw new BadRequestException({
        message: 'Record the approval reference before turning this on.',
        details: { code: 'APPROVAL_REQUIRED' },
      });
    }

    await this.repository.runInternal(async (tx) => {
      const before = await tx.featureSwitch.findUnique({ where: { key } });
      const wasEnabled = before ? before.isEnabled : definition.defaultEnabled;

      await tx.featureSwitch.upsert({
        where: { key },
        create: {
          key,
          isEnabled: input.enabled,
          approvalReference: input.enabled ? input.approvalReference : null,
          reason: input.reason,
          updatedById: actor.userId,
        },
        update: {
          isEnabled: input.enabled,
          approvalReference: input.enabled ? input.approvalReference : null,
          reason: input.reason,
          updatedById: actor.userId,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'feature.switch.changed',
          entityType: 'feature_switch',
          entityId: key,
          metadata: {
            key,
            before: wasEnabled,
            after: input.enabled,
            approvalReference: input.enabled ? input.approvalReference : null,
            reason: input.reason,
            correlationId: actor.correlationId,
          },
        },
      });
    });

    this.logger.log({
      event: 'AnalyticsEvent',
      action: 'feature.switch.changed',
      actorUserId: actor.userId,
      entityId: key,
      correlationId: actor.correlationId,
    });

    const refreshed = await this.list();
    const updated = refreshed.switches.find((entry) => entry.key === key);
    if (!updated) throw new NotFoundException('Unknown feature switch.');
    return updated;
  }
}
