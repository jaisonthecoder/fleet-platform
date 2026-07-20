import { performance } from 'node:perf_hooks';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PolicyEvaluatorService } from '../src/modules/policy/services/policy-evaluator.service';
import { PdpModule } from '../src/pdp.module';

/**
 * PDP latency **floor** (Phase 0 gate: `evaluate()` p95 < 200 ms). Requires a
 * live DB + Redis. This is the floor on a near-empty DB (P0B-R1-3); the
 * *binding* load test with real modules + migrated data is Phase 1 Block G.
 * Runs many evaluations against the seeded rule and asserts the p95 percentile.
 */
describe('PDP latency floor (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let evaluator: PolicyEvaluatorService;
  const BUDGET_MS = 200;
  const ITERATIONS = 3000;

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(PdpModule, { logger: false });
    evaluator = ctx.get(PolicyEvaluatorService);
    // Warm the compiled-rule cache so the run measures steady-state.
    await evaluator.evaluate({ ruleType: 'driver-eligibility', context: { eligible: true } });
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it(`keeps evaluate() p95 < ${BUDGET_MS} ms over ${ITERATIONS} calls`, async () => {
    const durations: number[] = [];
    const wave = 100;
    for (let i = 0; i < ITERATIONS; i += wave) {
      await Promise.all(
        Array.from({ length: wave }, async () => {
          const start = performance.now();
          await evaluator.evaluate({
            ruleType: 'driver-eligibility',
            context: { eligible: true },
          });
          durations.push(performance.now() - start);
        }),
      );
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p50 = durations[Math.floor(durations.length * 0.5)];
    // eslint-disable-next-line no-console
    console.log(
      `PDP floor: n=${durations.length} p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms`,
    );
    expect(p95).toBeLessThan(BUDGET_MS);
  });
});
