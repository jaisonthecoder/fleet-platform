import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_SWITCHES, type FeatureSwitchKey } from '../../contracts/feature-switches';

import { FEATURE_SWITCH_KEY } from '../decorators/require-feature.decorator';
import { FeatureSwitchService } from '../features/feature-switch.service';

/**
 * Enforces @RequireFeature.
 *
 * Unlike PermissionGuard this fails open when nothing is declared: most endpoints
 * are not optional capabilities, so an absent decorator means "always available"
 * rather than a mistake.
 *
 * The refusal names the switch on purpose. An operator whose tab was open when an
 * administrator turned a capability off should be told why, not shown an
 * unexplained failure.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly switches: FeatureSwitchService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<FeatureSwitchKey[] | undefined>(
      FEATURE_SWITCH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    for (const key of required) {
      if (!(await this.switches.isEnabled(key))) {
        // `details` survives the exception filter; anything else but `message` is dropped.
        throw new ForbiddenException({
          message: `${FEATURE_SWITCHES[key].label} is turned off in Feature management.`,
          details: { code: 'FEATURE_DISABLED', switch: key },
        });
      }
    }

    return true;
  }
}
