import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import type { FeatureSwitchKey } from '../../contracts/feature-switches';
import type { FeatureSwitchService } from '../features/feature-switch.service';
import { FeatureGuard } from './feature.guard';

/**
 * The guard is the control for foundation rule 4 - the screen hiding a button is
 * only the courtesy. Until now nothing tested it, so a regression here would have
 * silently reopened every optional capability.
 */
describe('FeatureGuard', () => {
  function build(required: FeatureSwitchKey[] | undefined, enabled: Record<string, boolean>) {
    const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
    const switches = {
      isEnabled: async (key: FeatureSwitchKey) => enabled[key] ?? false,
    } as unknown as FeatureSwitchService;

    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;

    return { guard: new FeatureGuard(reflector, switches), context };
  }

  it('allows a route that declares no switch', async () => {
    // Fails OPEN by design: most endpoints are not optional capabilities, so an
    // absent decorator means "always available" rather than a forgotten guard.
    const { guard, context } = build(undefined, {});

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows an empty switch list', async () => {
    const { guard, context } = build([], {});

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows when the declared switch is on', async () => {
    const { guard, context } = build(['quotations.portal_pricing'], {
      'quotations.portal_pricing': true,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('refuses when the declared switch is off, naming it', async () => {
    const { guard, context } = build(['quotations.portal_pricing'], {
      'quotations.portal_pricing': false,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);

    // The key travels in `details` so an operator whose tab was open when an
    // administrator flipped the switch is told which capability went away.
    await guard.canActivate(context).catch((error: ForbiddenException) => {
      expect(error.getResponse()).toMatchObject({
        details: { code: 'FEATURE_DISABLED', switch: 'quotations.portal_pricing' },
      });
    });
  });

  it('refuses when any one of several declared switches is off', async () => {
    const { guard, context } = build(
      ['quotations.portal_pricing', 'quotations.multi_option'],
      { 'quotations.portal_pricing': true, 'quotations.multi_option': false },
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
