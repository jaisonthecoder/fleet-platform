---
applyTo: "apps/noatum-customer-portal-ui/**"
description: React SPA conventions — tokens, forms, i18n, accessibility
---

# Portal web rules (apps/noatum-customer-portal-ui)

React + TypeScript on **Vite** (ADR-002 — not Next.js; do not introduce SSR without a
new ADR). TanStack Query, react-hook-form + zod, i18next, MapLibre.

## Design tokens only

Every colour, font, radius and spacing value comes from `@/design-system`. **No hex, no `font-family`, no `border-radius` in this app.** Compose the design-system components; never restyle them.

The brand: one red `#AA272F` doing nearly all accent work, navy `#002C5F` for the logo
and dark hero imagery only, **square-cornered cards** with a soft shadow, **4px radius on
buttons and inputs only**, a 40x3px red rule under section headings, 1170px container.
No gradients, no rounded feature cards, no blur, no scale or bounce — plain fast fades.

Status colours are a separate extension set so they do not compete with the action red:
success green, warning amber, informational navy, neutral grays.

## Forms and validation

Use react-hook-form with a zod schema **generated from the API OpenAPI document**, not
a hand-written copy. This app shares no code with `apps/noatum-customer-portal-api`, so the spec is the contract:
regenerate the client when the API changes rather than editing types by hand.

A client-side check is a convenience, never a second rulebook — the server validates
every request regardless.

## Never filter tenants in React

The API returns only what the user may see. If a list looks wrong, the bug is in the
tenant scoping on the server, not something to patch with a client-side filter.

Use `permissions` from `/me` to hide controls — but hiding a button is not
authorization. The server re-checks every call.

## Strings, dates, money

- Every string goes through i18next with **both** `en-US.json` and `es-ES.json` entries.
  A missing Spanish key fails the build; it does not fall back.
- **No emoji. No exclamation marks.** Sentence-case headlines. Links read "Read more…".
- Dates render `DD.MM.YYYY`. Store UTC, render in the timezone of the viewer at the edge.
- Money shows the **currency code with the amount**, never a bare symbol.

## Every data view

Loading, empty and error states are required — all three, every time.

Lists paginate server-side. Never load an unbounded list: the budget is under 2 s at
100k rows per group, search under 1.5 s, a wizard step under 300 ms.

## Accessibility — WCAG 2.1 AA, checked by axe in CI

Keyboard reachable, visible focus, a label on every input, colour never the only signal.
Muted gray `#A7A7A6` **fails AA for body copy** — it is decorative and meta only.

## Feature flags

Check `customerGroup.feature_flags` and hide the feature when it is off. The API enforces
it too; the UI simply avoids offering something that will be refused.
