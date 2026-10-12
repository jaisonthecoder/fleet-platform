import { SetMetadata } from '@nestjs/common';
import type { FeatureSwitchKey } from '../../contracts/feature-switches';

export const FEATURE_SWITCH_KEY = 'noatum:feature-switch';

/**
 * Declare the platform feature switch an endpoint needs.
 *
 * Independent of @RequirePermission: holding the permission is not enough if the
 * capability is switched off, and vice versa. Both must pass.
 *
 * Multiple keys are ANDed.
 */
export const RequireFeature = (...switches: FeatureSwitchKey[]) =>
  SetMetadata(FEATURE_SWITCH_KEY, switches);
