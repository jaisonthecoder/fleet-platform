# Phase 1 — Feedback & Notifications

> **Goal.** Ship the feedback layer every screen relies on: transient **toasts**, inline **alerts**,
> page **banners**, and the **loading / empty** states. All shadcn-based, Wayfinder-skinned, both
> themes, RTL, i18n.

Prereq: read `00_Overview_and_Principles.md`. Dependency to add: **`sonner`**.

---

## Components

### 1. Toast / Toaster — `components/ui/sonner.tsx` + `hooks/use-toast.ts`
- Use **`sonner`** (the current shadcn toast standard) over the legacy Radix toast.
- Mount `<Toaster />` once in `AppProviders` (inside theme + i18n so it inherits `dir` and theme).
- **Theme:** pass `theme` from `useTheme()`; skin toasts via `toastOptions.classNames` to tokens —
  `bg-card`, `text-foreground`, `border-border`, radius 3px, `--shadow-raised`. Position:
  bottom-end (`richColors` OFF — we supply our own tones).
- **Tones** (helper `notify.ok/warn/danger/info(message, opts)`): map to `--ok/--warn/--danger/--info`
  with a leading icon (never colour alone). Include an optional **action** button + description.
- **RTL:** position flips to bottom-start under `dir="rtl"`; verify swipe direction.
- **a11y:** sonner uses an ARIA live region — keep it; ensure messages are announced, not just visual.
- **States:** default · success · warning · danger · info · loading (promise toast) · with-action · dismissible.

### 2. Alert (inline banner) — upgrade `components/ui/alert.tsx`
- Already exists (neutral). Add **tone variants** via `cva`: `neutral | info | ok | warn | danger`,
  each = soft token fill + border (`bg-warning/10 border-warning/30 text-warning`) + **leading icon**
  + title + description + optional action slot.
- Enforce the **"blocks explain themselves"** principle: a danger alert should read cause + next action.
- Grid layout `[auto_1fr]` (icon + content); wraps cleanly; RTL mirrors.

### 3. Banner — `components/patterns/banner.tsx`
- Full-width page-level notice (e.g. "1 fine needs your attention" from the Helm home). Tone + icon +
  message + optional CTA + dismiss. Sits above page content, not sticky by default.

### 4. Skeleton — extend `components/ui/skeleton.tsx`
- Already exists. Add **compositional skeletons** in `patterns/skeletons.tsx`: `CardSkeleton`,
  `TableRowSkeleton`, `FormSkeleton`, `StatSkeleton`. **Structure-shaped, no spinners** for content.

### 5. Spinner / inline progress — `components/ui/spinner.tsx`
- Small `Loader2` spinner for buttons/inline async only (route fallback already uses one). Respect
  `prefers-reduced-motion`.

### 6. Progress — `components/ui/progress.tsx`
- Radix `@radix-ui/react-progress` (add) OR a simple token bar. Determinate + indeterminate;
  `--brand` fill on `--surface-2` track; used by uploads, multi-step flows, fuel gauges.

### 7. Empty state — `components/patterns/empty-state.tsx`
- Icon + title + description + optional primary action. Used for "no results", "nothing pending".
  Calm, centred, muted. Distinct from error (which offers retry).

---

## Design / token mapping

| Element | Tokens |
|---|---|
| Toast surface | `bg-card` / `text-foreground` / `border-border` / shadow `--shadow-raised` / radius 3px |
| ok / warn / danger / info | `--ok` `#1F7A4D` / `--warn` `#C1791F` / `--danger` `#B33F3F` / `--info` `#0E5C7A` (soft = `/10` fill, `/30` border) |
| Skeleton | `bg-muted` (=`--surface-2`) pulse |
| Progress track / fill | `bg-surface-2` / `bg-brand` |

---

## Tasks

- [x] Add `sonner`; create `ui/sonner.tsx` (themed) + `hooks/use-toast.ts` (`notify.*` helpers, i18n-friendly).
- [x] Mount `<Toaster />` in `AppProviders`; wire `theme` + `dir`.
- [x] Upgrade `ui/alert.tsx` with tone variants + icons + action slot.
- [x] `patterns/banner.tsx`, `patterns/empty-state.tsx`, `patterns/skeletons.tsx`, `ui/spinner.tsx`, `ui/progress.tsx`.
- [x] Add all of the above to the design showcase (both themes, RTL).
- [x] Tests: toast fires + dismisses + action; alert renders tone/icon; empty-state action fires.

## Exit checklist

- [x] A `notify.ok/warn/danger/info` toast shows correct tone + icon, is announced to SR, mirrors in RTL, respects theme.
- [x] Alert tones + banner + empty state + skeletons render correctly in light **and** dark.
- [x] Gate green (tsc / oxlint / vitest / build). *(oxlint: one accepted `prefer-tag-over-role` warning on Progress.)*
