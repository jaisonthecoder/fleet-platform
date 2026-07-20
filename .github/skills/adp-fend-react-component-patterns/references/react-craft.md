# React Craft

Everyday React patterns that separate high-quality code from code that technically works. Read this when writing or reviewing components and hooks.

## Table of Contents

- [React Craft](#react-craft)
  - [Contents](#contents)
  - [Rules of Hooks](#rules-of-hooks)
  - [Keys in lists](#keys-in-lists)
  - [Derived state — don't store it](#derived-state--dont-store-it)
  - [`useState` type narrowing](#usestate-type-narrowing)
  - [Effect cleanup](#effect-cleanup)
    - [Legitimate `useEffect` use-cases](#legitimate-useeffect-use-cases)
  - [Memoization — three distinct tools](#memoization--three-distinct-tools)
    - [`useMemo` — cache an expensive value](#usememo--cache-an-expensive-value)
    - [`useCallback` — stable function identity](#usecallback--stable-function-identity)
    - [`React.memo` — skip re-renders of a child](#reactmemo--skip-re-renders-of-a-child)
  - [`useId` for accessibility](#useid-for-accessibility)
  - [Accessibility quick-test runbook](#accessibility-quick-test-runbook)
  - [Refs and imperative handles](#refs-and-imperative-handles)
  - [Portals](#portals)
  - [Error boundaries](#error-boundaries)
  - [Suspense](#suspense)
  - [Context — avoid re-render storms](#context--avoid-re-render-storms)
    - [Split by concern](#split-by-concern)
    - [Stabilize the value](#stabilize-the-value)
  - [Controlled vs uncontrolled inputs](#controlled-vs-uncontrolled-inputs)
  - [Composition patterns](#composition-patterns)
    - [Slots / `children`](#slots--children)
    - [Compound components](#compound-components)
    - [Headless hooks](#headless-hooks)
  - [Props design](#props-design)
  - [`className` merging](#classname-merging)
  - [Async state in event handlers](#async-state-in-event-handlers)
  - [Common anti-patterns — bad → good](#common-anti-patterns--bad--good)
    - [God component](#god-component)
    - [`useEffect`-driven fetch](#useeffect-driven-fetch)
    - [Unstable query keys](#unstable-query-keys)
    - [Hard-coded user-visible strings](#hard-coded-user-visible-strings)
    - [Physical-direction CSS](#physical-direction-css)
  - [Quick-reference: when to reach for what](#quick-reference-when-to-reach-for-what)

## Rules of Hooks

Non-negotiable. Violations are undefined behavior, not style issues.

- Call hooks at the top level of a component or another hook — never inside conditions, loops, `try`/`catch`, or after early returns.
- Only call hooks from React components or custom hooks (names starting with `use`).
- Enable `eslint-plugin-react-hooks` and treat its warnings as errors in CI.

## Keys in lists

- Always provide `key` when rendering a list.
- **Key by stable domain id**, not by array index.
- `key={item.id}` is right. `key={index}` is wrong when the list can reorder, insert, or delete — it causes lost input state, lost focus, and incorrect animations.
- `key` must be unique among siblings, not globally.

```tsx
// ❌ Wrong — reorder or delete corrupts state
{items.map((item, i) => <Row key={i} item={item} />)}

// ✅ Right
{items.map((item) => <Row key={item.id} item={item} />)}
```

## Derived state — don't store it

If a value can be computed from props or other state, do not put it in state.

```tsx
// ❌ Wrong — duplicated source of truth
const [fullName, setFullName] = useState(`${first} ${last}`);
useEffect(() => setFullName(`${first} ${last}`), [first, last]);

// ✅ Right — derive on render
const fullName = `${first} ${last}`;

// ✅ Right when the derivation is expensive
const fullName = useMemo(() => expensiveCompute(first, last), [first, last]);
```

The same applies to filtered/sorted lists — derive, don't cache in state.

## `useState` type narrowing

Always type `useState` explicitly when the initial value is `null`, `undefined`, or `[]`.

```tsx
// ❌ Infers `undefined`, breaks when you try to set a value
const [user, setUser] = useState();

// ✅
const [user, setUser] = useState<User | null>(null);
const [vessels, setVessels] = useState<Vessel[]>([]);
```

## Effect cleanup

Every subscription, timer, observer, and abort controller started in `useEffect` must be cleaned up.

```tsx
// ✅ Interval
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);

// ✅ Fetch with abort (rarely needed — prefer TanStack Query)
useEffect(() => {
  const ac = new AbortController();
  fetch('/api/x', { signal: ac.signal }).catch(/* ignore abort */);
  return () => ac.abort();
}, []);

// ❌ Async directly — returns a Promise, not a cleanup
useEffect(async () => { /* ... */ }, []);

// ✅ Async inside
useEffect(() => {
  let cancelled = false;
  (async () => {
    const data = await load();
    if (!cancelled) setData(data);
  })();
  return () => { cancelled = true; };
}, []);
```

Server state belongs in TanStack Query, not `useEffect`.

### Legitimate `useEffect` use-cases

The "no `useEffect` for data" rule is not "no `useEffect`." Use it for genuine side effects:

- **Subscribing to non-React event sources** — websockets, `BroadcastChannel`, browser events (`resize`, `online/offline`), `IntersectionObserver`, `MutationObserver`. Every subscription returns a cleanup.
- **Imperative APIs** — focus management after navigation, scroll restoration, programmatic `dialog.showModal()` calls, integration with non-React libraries (charts, maps, editors) that need a DOM node.
- **Browser-only side effects** — analytics page-views, document title (pre-React-19), favicon swaps, syncing component state out to localStorage/sessionStorage (debounced).
- **Tearing down resources** — timers, intervals, abort controllers (when not using TanStack Query for the request).

If your `useEffect` is doing any of these, it's correct. If it's calling `fetch` or syncing one piece of state to another piece of state in the same component, it's almost certainly wrong — convert to a query or a `useMemo`/`computed`.

## Memoization — three distinct tools

Don't collapse these. Each solves a different problem.

### `useMemo` — cache an expensive value

Use when computation is measurably expensive and inputs change rarely.

```tsx
const sortedVessels = useMemo(
  () => vessels.slice().sort(byDepartureDate),
  [vessels],
);
```

Do not wrap cheap computations. `useMemo(() => a + b, [a, b])` costs more than `a + b`.

### `useCallback` — stable function identity

Use when the function is a dependency of another hook (effect, memo, child `React.memo`).

```tsx
const onSelect = useCallback((id: string) => setSelected(id), []);

useEffect(() => {
  subscribe(onSelect);
  return () => unsubscribe(onSelect);
}, [onSelect]); // Without useCallback, this re-subscribes every render.
```

Not needed when the function is just a handler on a DOM element.

### `React.memo` — skip re-renders of a child

Use when a child is pure, renders often, and its props are referentially stable.

```tsx
export const VesselRow = React.memo(function VesselRow({ vessel }: Props) {
  return <tr>{/* ... */}</tr>;
});
```

`React.memo` does nothing if you pass new object/array/function references every render — pair with `useMemo` / `useCallback` on the parent, or it's a no-op.

**Default: don't memoize.** Measure first (React DevTools Profiler). Memoize the hotspot.

## `useId` for accessibility

Use `useId` for unique ids tied to a component instance — never `Math.random()`, never a module-level counter.

```tsx
const id = useId();
return (
  <>
    <label htmlFor={id}>Name</label>
    <input id={id} />
  </>
);
```

**Why `useId` exists:** under SSR or hydration, `Math.random()` and module counters generate different ids on the server vs the client, causing hydration mismatches. `useId` produces ids that match across both render passes — that's the whole point of the hook. Even in pure CSR apps it's better than ad-hoc counters because Strict Mode double-invocation breaks counters.

## Accessibility quick-test runbook

`jest-axe` and `axe-playwright` catch a lot in CI, but they don't catch logic-flow bugs (a modal that traps focus on the wrong element, a screen reader announcing a stale region). Run this 5-minute check before declaring a screen done. If you can't fix what you find, document it in the PR.

1. **Keyboard-only walk.** Unplug your mouse. Tab through the page. Can you reach every action? Does focus stay visible at every stop? Does Tab order match visual order?
2. **`Esc` on every overlay.** Open every dialog, drawer, dropdown, popover, tooltip. Press `Esc`. Does it close? Where does focus return? (It must return to the trigger.)
3. **Zoom to 200%.** `Ctrl/Cmd + +` four times. Does any control overflow off-screen, become unreachable, or hide critical text?
4. **Forced colors / high contrast.** Toggle the OS or browser high-contrast mode. Are buttons still distinguishable? Are focus rings still visible?
5. **Screen reader sweep.** macOS: `Cmd+F5` for VoiceOver, then `Ctrl+Opt+→` to walk. Windows: NVDA, then arrow keys. Navigate by headings (`H` in NVDA, `Ctrl+Opt+Cmd+H` in VoiceOver). Do the headings make sense without the rest of the page?
6. **Live regions.** Trigger an async action (form submit, mutation success). Does the screen reader announce the result, or does it stay silent?
7. **Color contrast.** DevTools → Inspect → Accessibility panel → Contrast ratio. Aim for AA on text (4.5:1), AAA where labelled (7:1). The Figma palette should be pre-validated, but custom one-off classes drift.
8. **`prefers-reduced-motion`.** Toggle in OS settings. Animations should reduce to a 1-frame fade or disappear; never block input.
9. **RTL pass.** Switch to `ar` locale. Are direction-sensitive icons mirrored? Is the modal close button on the correct side? Do dropdowns anchor correctly?

If the answer to any of these is "no" or "I don't know," fix it before review. Reviewers run the same checklist.

## Refs and imperative handles

- `useRef` — hold a mutable value that doesn't cause re-renders (DOM node, timer id, mutable cache).
- `forwardRef` — let a parent focus/measure/scroll the DOM node of a child.
- `useImperativeHandle` — expose a narrow imperative API from a child (`ref.current.focus()`, `ref.current.reset()`). Use sparingly; declarative props are usually better.

```tsx
type InputHandle = { focus: () => void };

/*
 * Exposes a narrow imperative API (`focus()`) to the parent ref while keeping the underlying input encapsulated.
 * Use this only when declarative props can't express the need (e.g. focusing on a parent-driven event).
 */
export const TextInput = forwardRef<InputHandle, Props>(function TextInput(props, ref) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inner.current?.focus() }), []);
  return <input ref={inner} {...props} />;
});
```

## Portals

Use `createPortal` for modals, tooltips, toasts, and dropdowns that must escape their parent's stacking context, overflow, or transform.

```tsx
return createPortal(<Modal />, document.body);
```

Without a portal, a modal rendered inside a `overflow: hidden` ancestor is clipped.

## Error boundaries

- Place one at the top of the app (catches crashes that escape everything else).
- Place one per route (so one feature's bug doesn't blank the app).
- Place one around a third-party widget you don't trust.

Use `react-error-boundary`:

```tsx
import { ErrorBoundary } from 'react-error-boundary';

/*
 * Catches render-time crashes inside <Feature/>. FallbackComponent renders the recovery UI;
 * onError forwards the original error to Sentry so the stack trace isn't lost when the user retries.
 * Note: this does NOT catch async/event-handler errors — handle those with try/catch + toast.
 */
<ErrorBoundary
  FallbackComponent={({ error, resetErrorBoundary }) => (
    <ErrorScreen
      message={error.message}
      onRetry={resetErrorBoundary}
    />
  )}
  onError={(error) => reportToSentry(error)}
>
  <Feature />
</ErrorBoundary>
```

Error boundaries only catch render, lifecycle, and constructor errors — not event handlers or async code. For those, use try/catch + toast/state.

## Suspense

- `Suspense` boundaries define loading UI for lazy components and (with TanStack Query's `useSuspenseQuery`) data fetching.
- Place a boundary **where it makes sense to show a skeleton** — usually the content area of a page, not the whole app.
- Co-locate with an error boundary: Suspense handles "still loading," Error Boundary handles "failed to load."

```tsx
// Co-locate Suspense (handles "still loading") inside an ErrorBoundary (handles "failed to load") — the boundary order matters: errors thrown during suspense fall through to the outer boundary.
<ErrorBoundary FallbackComponent={ErrorScreen}>
  <Suspense fallback={<PageSkeleton />}>
    <VesselDetailPage />
  </Suspense>
</ErrorBoundary>
```

## Context — avoid re-render storms

Context re-renders every consumer when its value changes. Two mitigations:

### Split by concern

```tsx
// ❌ One context — every consumer re-renders when anything changes
<AppContext.Provider value={{ user, theme, cart }}>

// ✅ Split
<UserContext.Provider value={user}>
  <ThemeContext.Provider value={theme}>
    <CartContext.Provider value={cart}>
```

### Stabilize the value

```tsx
// ❌ New object every render; every consumer re-renders
<UserContext.Provider value={{ user, updateUser }}>

// ✅
const value = useMemo(() => ({ user, updateUser }), [user, updateUser]);
<UserContext.Provider value={value}>
```

If splitting and memoizing aren't enough, reach for Zustand (selectors prevent re-renders of components that don't depend on the changed slice).

## Controlled vs uncontrolled inputs

- **Controlled** (`value` + `onChange`) when you need to read, transform, or reset the value while the user types.
- **Uncontrolled** (`defaultValue`, read via `ref` on submit) when the value is only read on submit. Faster; less re-rendering.
- In forms, let react-hook-form own this — it defaults to uncontrolled with register().

## Composition patterns

### Slots / `children`

Pass JSX down through props or `children` instead of accepting config objects.

```tsx
// ❌
<Dialog title="Confirm" body="Are you sure?" actions={[{ label: 'OK', ... }]} />

// ✅
<Dialog>
  <Dialog.Header>Confirm</Dialog.Header>
  <Dialog.Body>Are you sure?</Dialog.Body>
  <Dialog.Actions><Button>OK</Button></Dialog.Actions>
</Dialog>
```

### Compound components

Group related pieces under a namespace. Parent provides context; children consume it.

```tsx
<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
    <Tabs.Trigger value="specs">Specs</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="overview">...</Tabs.Content>
  <Tabs.Content value="specs">...</Tabs.Content>
</Tabs>
```

### Headless hooks

Encapsulate behavior as a hook; let the consumer render whatever they want.

```tsx
const { isOpen, open, close, triggerProps, contentProps } = useDisclosure();
```

Good when behavior is reused but UI differs across features.

## Props design

- Prefer **discriminated unions** over optional flags. The compiler enforces valid combinations.

```tsx
// ❌ Any combination is legal
type Props = { variant?: 'primary' | 'danger'; confirm?: string };

// ✅ `confirm` is required only on 'danger'
type Props =
  | { variant: 'primary' }
  | { variant: 'danger'; confirm: string };
```

- Accept `children` for slot-like composition rather than a `content` prop.
- Accept `className` and `...rest` on presentational components so callers can extend styling.
- Mark handlers with `on*` (`onClick`, `onSelect`), state props without a prefix (`disabled`, `isOpen`).

## `className` merging

Use `clsx` for conditional classes and `tailwind-merge` to resolve Tailwind conflicts (`px-2 px-4` → `px-4`).

```tsx
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

<button className={cn('px-4 py-2', isDanger && 'bg-red-600', className)} />
```

For components with many variants, use `class-variance-authority` (`cva`).

## Async state in event handlers

Event handlers are not wrapped by React. Errors escape. Show a message.

```tsx
async function onSubmit() {
  try {
    await save();
    toast.success('Saved');
  } catch (err) {
    toast.error(extractMessage(err));
    reportToSentry(err);
  }
}
```

With TanStack Query mutations, use `onError` instead of try/catch.

## Common anti-patterns — bad → good

> The **catalog** of forbidden patterns (rejection-citable) is `references/anti-patterns.md`. The pairs below are **worked examples** for the highest-leverage cases — read both: catalog for citation, this for understanding.

### God component

```tsx
// ❌ 400 LOC, fetches, filters, sorts, renders a table, handles a dialog
function VesselManager() { /* ... */ }

// ✅ Feature hook + page + feature components
function VesselListPage() {
  const { vessels, filters, actions } = useVesselBooking();
  return (
    <>
      <VesselFilters filters={filters} onChange={actions.setFilter} />
      <VesselTable vessels={vessels} onSelect={actions.selectVessel} />
      <BookingDialog />
    </>
  );
}
```

### `useEffect`-driven fetch

```tsx
// ❌ Re-fetches on every mount, no cache, no request cancellation
const [vessels, setVessels] = useState<Vessel[]>([]);
useEffect(() => {
  fetch('/api/vessels').then((r) => r.json()).then(setVessels);
}, []);

// ✅ TanStack Query
const { data: vessels, isLoading, error } = useVessels(filters);
```

### Unstable query keys

```tsx
// ❌ `filters` is a new object each render — cache never hits
function useVessels() {
  const filters = { status: 'available' };
  return useQuery({ queryKey: ['vessels', filters], queryFn: ... });
}

// ✅ Pass primitives through the key factory
function useVessels(filters: VesselFilters) {
  return useQuery({ queryKey: vesselKeys.list(filters), queryFn: () => api.list(filters) });
}
```

### Hard-coded user-visible strings

```tsx
// ❌
<button>Save and continue</button>

// ✅
const { t } = useTranslation('vessels');
<button>{t('actions.saveAndContinue')}</button>
```

### Physical-direction CSS

```tsx
// ❌ Breaks in Arabic/RTL
<div className="ml-4 pr-2 left-0">

// ✅ Logical properties
<div className="ms-4 pe-2 start-0">
```

## Quick-reference: when to reach for what

| Need | Reach for |
|---|---|
| Shared state inside one component | `useState` |
| State that depends on previous state | `useReducer` |
| Expensive computed value | `useMemo` |
| Stable function identity | `useCallback` |
| Skip child re-renders | `React.memo` (+ the above) |
| Unique accessible id | `useId` |
| Imperative handle to a child | `forwardRef` + `useImperativeHandle` |
| Escape the stacking context | `createPortal` |
| Catch a render crash | Error Boundary |
| Load boundary + skeleton | `Suspense` |
| Cross-component feature state | Context + reducer → Zustand if re-render pressure |
| Server state | TanStack Query |
| URL state (filters, tabs) | React Router search params + zod |
| Class composition | `clsx` + `tailwind-merge` (or `cva` for variants) |
| Mark a non-urgent state update | `useTransition` (keep the UI responsive while expensive renders complete) |
| Defer rendering of an expensive computation | `useDeferredValue` (let urgent updates win) |
| Subscribe to an external (non-React) store | `useSyncExternalStore` |
| Re-render only when one slice of a store changes | Zustand selector (`useStore((s) => s.slice)`) — or `use-context-selector` if Context is forced |
| UI primitive (button/dialog/input/select/...) | `@shared/ui/<primitive>` (shadcn-vendored) — never re-implement |
| Icon | `<Icon name="..." />` from `@shared/ui/icon` — never `import from 'lucide-react'` directly |
