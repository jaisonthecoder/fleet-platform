# Workflow — Component Test with `@playwright/experimental-ct-react`

Use when the component:

- Depends on real CSS / layout / `getComputedStyle`.
- Uses IntersectionObserver or ResizeObserver.
- Renders inside a route boundary that jsdom mishandles.

## Steps

1. Install: `npm init playwright@latest -- --ct` (one-time per repo).
2. Configure `playwright/index.{ts,tsx}` with `beforeMount` (theme, MSW handler set-up).
3. Author `<Component>.spec.tsx`:

   ```tsx
   import { test, expect } from '@playwright/experimental-ct-react';
   import { handlers } from '@src/mocks/handlers';

   test.beforeEach(async ({ router }) => {
     await router.use(...handlers);
   });

   test('renders', async ({ mount }) => {
     const c = await mount(<VesselCard vessel={{ name: 'MV Khalifa' }} />);
     await expect(c).toContainText('MV Khalifa');
   });
   ```

4. Run: `npx playwright test --project=component`.

## When NOT to use

- Simple props/callbacks tests (use RTL).
- Hooks (use `renderHook`).
- Network-only scenarios (use MSW + RTL).

## Before you start

- [ ] You have the SKILL.md `## Hard rules` and `## Quality bar` in view.
- [ ] You have read the topical sections of this workflow before starting work.
- [ ] Required inputs named in the parent SKILL.md `## Inputs` are present.

## Anti-patterns

- Skipping the `## Before you start` checklist.
- Diverging from the topical guidance without recording an exception.
- Marking work complete without the evidence listed in the workflow body.

## After you finish

- [ ] Each topical section above is addressed (or skipped with a recorded reason).
- [ ] Evidence committed alongside the artefact per the parent `SKILL.md` quality bar.
- [ ] Handoff routed per the `## Handoff` block above (or per `SKILL.md` if absent).
