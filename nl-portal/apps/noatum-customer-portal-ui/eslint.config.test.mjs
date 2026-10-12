// @vitest-environment node

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const require = createRequire(resolve('eslint.config.cjs'));
const legacy = require('./.eslintrc.cjs');
const eslint = new ESLint({ cwd: process.cwd() });

describe('UI lint configuration', () => {
  it('preserves every legacy rule and its options', async () => {
    const config = await eslint.calculateConfigForFile('src/lint-fixture.tsx');
    const severity = { off: 0, warn: 1, error: 2 };
    for (const [name, setting] of Object.entries(legacy.rules)) {
      const [level, ...options] = Array.isArray(setting) ? setting : [setting];
      expect(config.rules[name], name).toEqual([severity[level], ...options]);
    }
  }, 90_000);

  it.each([
    ['API boundary', "import 'noatum-customer-portal-api';", 'no-restricted-imports'],
    [
      'API source boundary',
      "import '../../noatum-customer-portal-api/src/app';",
      'no-restricted-imports',
    ],
    ['simulator boundary', "import '@noatum/cw1-simulator';", 'no-restricted-imports'],
    ['React keys', 'export const items = [<div />];', 'react/jsx-key'],
    ['core recommended rules', 'debugger;', 'no-debugger'],
  ])('enforces %s', async (_name, source, ruleId) => {
    const [result] = await eslint.lintText(source, { filePath: 'src/lint-fixture.tsx' });
    expect(result.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId, severity: 2 })]),
    );
  });

  it('excludes generated API output but includes source and browser tests', async () => {
    expect(await eslint.isPathIgnored('src/api/generated/schema.d.ts')).toBe(true);
    expect(await eslint.isPathIgnored('src/app/App.tsx')).toBe(false);
    expect(await eslint.isPathIgnored('e2e/lint-fixture.spec.ts')).toBe(false);
  });
});
