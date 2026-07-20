# Vitest Projects / Workspace (AD Ports)

For the submodule layout (see [`../../adp-qa-test-strategy/references/test-repo-layout.md`](../../adp-qa-test-strategy/references/test-repo-layout.md)), the unit-tests submodule uses `vitest.workspace.ts`:

```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'web-unit',
      environment: 'jsdom',
      include: ['frontend/**/*.test.tsx'],
      setupFiles: ['frontend/setup.ts'],
    },
  },
  {
    test: {
      name: 'web-browser',
      browser: { enabled: true, name: 'chromium', headless: true },
      include: ['frontend/**/*.browser.test.tsx'],
    },
  },
]);
```

CI runs `vitest --workspace vitest.workspace.ts --coverage --reporter junit`.
