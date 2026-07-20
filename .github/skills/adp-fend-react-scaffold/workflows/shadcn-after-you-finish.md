# Workflow — After You Finish

Verification checklist. Run before declaring any kit work done — scaffold, extend, or feature application.

The kit is not done until 100% of these pass. "It probably works" is not a state the kit can ship in.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
Confirm the changed scope: scaffold, extension, or feature application. Open `SKILL.md`, the relevant workflow, and the changed kit files before running the checklist.

## Goal

Catch the predictable failures (hardcoded values, missing states, broken focus, dark-mode regressions) *before* features start consuming the kit.

## Steps

### Tokens & theming

- [ ] **No placeholder marker strings** anywhere in `styles/tokens.css`.
- [ ] **All required tokens defined** in both `:root` and `[data-theme="dark"]`. Cross-check against [`references/tokens-spec.md`](../references/tokens-spec.md) §"Required variables".
- [ ] **Every color value parses.** Render `/ui-kit` Foundations section → no missing swatches.
- [ ] **`--ring` passes WCAG AA** against `--background` and `--card` in both themes (computed in Foundations).
- [ ] **Every `-fg` token passes WCAG AA** against its counterpart in both themes.

### Component-level cleanliness

- [ ] **No hardcoded hex values in `components/ui/`.**
   ```bash
   grep -rE '#[0-9a-fA-F]{3,8}' components/ui/ --include='*.tsx' --include='*.ts'
   ```
   Should return empty. Allowed exceptions: hex literals inside `cva()` strings that resolve through Tailwind utilities (rare; flag for review).

- [ ] **No hardcoded pixel values in `components/ui/`.**
   ```bash
   grep -rE '\b[0-9]+px\b' components/ui/ --include='*.tsx' --include='*.ts'
   ```
   Should return empty. Allowed exceptions: explicit `1px` borders or motion durations where Tailwind utilities don't cover the case.

- [ ] **No `var(--token)` references inside JSX.** Components use Tailwind utilities; the utilities resolve through theme. Direct `var()` is a contract leak.
   ```bash
   grep -rE 'var\(--' components/ui/ --include='*.tsx'
   ```
   Should return empty (or only inside `style={{}}` blocks that have a documented reason).

### Showcase verification

- [ ] **`/ui-kit` renders without console errors.** Open dev tools → no red.
- [ ] **All 10 sections render in order.** Foundations → Patterns. No section skipped, no out-of-order.
- [ ] **Every interactive component shows all states** — default / hover / focus / disabled / loading where applicable. The Button 6×8×5 matrix is fully populated.
- [ ] **Every overlay opens and closes correctly.** Dialog, AlertDialog, Sheet, Drawer, Popover, HoverCard, Tooltip, DropdownMenu, ContextMenu, Menubar, Command — click each trigger.

### Dark mode (if enabled)

- [ ] **Toggle works end-to-end.** Click the theme toggle in `/ui-kit` header → page re-themes immediately, no flash.
- [ ] **Every section re-renders correctly in dark.** Walk all 10. Look for white-on-white, missing borders, broken contrast.
- [ ] **Focus rings still visible in dark.** Tab through forms / buttons in dark mode.
- [ ] **Shadows still readable in dark.** They may need a darker `--shadow-color` in dark mode.
- [ ] **No SSR flash** on first load. With `data-theme` set in `<html>` server-side or via blocking script.

### RTL (if enabled)

- [ ] **Toggle works end-to-end.** Click the RTL toggle → page mirrors immediately.
- [ ] **Forms section** mirrors correctly: labels right-aligned, controls flow RTL, placeholder text aligned.
- [ ] **Overlays section**: dropdowns open on the correct (left) side, menus flow RTL.
- [ ] **Navigation section**: sidebar collapses to the correct side, breadcrumb chevrons mirror, pagination "next" arrow points left.
- [ ] **No layout breakage** in any other section (Cards may need `space-x-*` → `space-x-reverse` adjustments — flag if found).

### Accessibility

- [ ] **Keyboard tab through `/ui-kit`.** Every focusable element receives focus and shows a visible ring.
- [ ] **No focus traps** (Dialog/Sheet excepted — those should trap intentionally and release on close).
- [ ] **Tooltip + HoverCard work on keyboard focus** — not just mouse hover.
- [ ] **Screen reader smoke test**: open VoiceOver / NVDA → tab through Buttons section → labels announced.
- [ ] **All `Field` slots used** in Forms section — label, description, error all rendered to demonstrate.
- [ ] **Color is not the only signal** — error states use icon + text, not just red.

### Mobile / responsive

- [ ] **375px width**: page renders without horizontal scroll on the showcase nav itself.
- [ ] **Sidebar primitive** collapses to `Sheet` at small breakpoints.
- [ ] **Tables** scroll horizontally inside their container, not the page.
- [ ] **Dialogs** respect viewport height; close button reachable.
- [ ] **Drawer** slides up from bottom on mobile (Vaul default).

### Documentation

- [ ] **`UI_KIT.md` exists** at project root and all `{{PLACEHOLDERS}}` are filled.
- [ ] **History table updated** with the date and a one-line description of what changed.
- [ ] **Hand-authored additions section** lists every `components/ui/*` file that wasn't from `shadcn add`.
- [ ] **Sections present table** matches reality — if the kit is missing a section, the table reflects that.

### Repo hygiene

- [ ] **`pnpm install` clean** — `package.json` and lockfile in sync.
- [ ] **`pnpm typecheck`** (or `tsc --noEmit`) passes.
- [ ] **`pnpm lint`** passes (or has only pre-existing unrelated warnings).
- [ ] **`pnpm dev`** starts without errors.
- [ ] **`pnpm build`** succeeds (catches things the dev server hides).
- [ ] **Working tree contains only kit-related changes** — no rogue commits to unrelated files.

### Sister-skill consistency (if both kits are in the project)

- [ ] **Section count matches `ng-bootstrap-kit`.** Both kits have 10 sections.
- [ ] **Component coverage roughly equivalent.** A user of either kit gets the same primitives by name.
- [ ] **`UI_KIT.md` notes both kits** if both are scaffolded in the same project.

## Anti-patterns

- Treating visual spot checks as a substitute for keyboard, dark-mode, RTL, and mobile checks.
- Accepting missing showcase states because the feature that needs them is not built yet.
- Reporting the kit done while `UI_KIT.md` still has placeholder values or stale section coverage.

## Common failures and fixes

| Failure | Cause | Fix |
|---|---|---|
| Foundations swatches all white | tokens.css not imported | Verify `@import "./tokens.css"` in globals.css |
| Buttons all look identical | Tailwind theme extension missing color names | Re-check [`references/tailwind-mapping.md`](../references/tailwind-mapping.md) |
| Dark mode flickers on first paint | `data-theme` set in client effect | Set in `<html>` server-side or via blocking script |
| Focus ring invisible | `--ring` token undefined or outline reset somewhere | Check tokens.css; remove blanket `outline: 0` |
| `Dialog` portal not styled | `globals.css` not imported in root | Verify root layout imports it |
| Lucide icons missing | `lucide-react` not installed | `pnpm add lucide-react` |
| Hot reload doesn't pick up token changes | Vite/Next caching CSS | Hard reload (Cmd+Shift+R) |
| `shadcn add` errors on install | Peer dep mismatch (React version) | Check `pnpm why react`; upgrade if < 18.2 |
| Hardcoded `px` from `cva()` defaults | shadcn ships some `px` in spacing classes | Acceptable for `1px` borders; flag others for follow-up |

## After you finish

Capture the checks run, unresolved risks, and the `/ui-kit` route used for visual verification in the handoff package.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- Every checkbox above is checked.
- The user has been shown the `/ui-kit` URL and confirmed it renders.
- `UI_KIT.md` is committed.
- The kit is ready to consume from features (use [`apply-to-feature.md`](apply-to-feature.md) when developers ask for help building things).
