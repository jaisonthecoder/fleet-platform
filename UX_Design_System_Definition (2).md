# Fleet Platform — UX Approach & Design System Definition

**Version 1.0 · Companion to Phase 1 MVP PRD · Codename: "Wayfinding"**

---

## 1. UX Philosophy

### 1.1 The one-line thesis

> Operational software for people in motion: a driver at 6 a.m., a fleet manager standing in a yard. Every screen must answer its question in seconds, in sunlight, on any device, in any language direction.

### 1.2 Five principles (every design decision traces to one)

1. **The 2-minute booking.** The core journey (search → select → consent → submit) completes in under 2 minutes for a returning user (NFR-USE-04). Every added field, click or modal must justify itself against this budget.
2. **Status is never color alone.** Vehicle and booking states are encoded in position, icon and label as well as color — for yard sunlight, color-blind users, and grayscale printouts. (WCAG 1.4.1)
3. **Blocks explain themselves.** When the platform says no (expired Mulkiya, black-points block, ineligible licence), the message names the reason and the next action. Errors direct; they never apologize or stay vague.
4. **The interface speaks the user's job.** "Book a vehicle," "Hand over," "Return" — never "create resource allocation." One verb per action, same verb through the whole flow: the button that says *Book* produces a confirmation that says *Booked*.
5. **Calm by default, loud on exception.** Normal operations are visually quiet. Attention is spent only where action is needed: an expiring document, a pending approval, an overdue transfer.

### 1.3 The aesthetic anchor: maritime wayfinding

The visual language borrows from the working port, not from generic dashboard templates:

- **Signal bars** — every card carries a slim left-edge status bar, like painted berth markings. Position + width make status legible before color is even perceived.
- **The availability strip** (signature element) — the day's vehicle slots rendered like berth occupancy on a harbor schedule. Time flows left→right (mirrored in RTL), occupied blocks are solid, open water is bookable. This is the one memorable element; everything around it stays disciplined.
- **Verification type** — plate numbers, booking IDs, chassis numbers set in monospace. Data a human verifies character-by-character gets a typeface built for it.
- **Structural honesty** — dividers, eyebrows and labels encode real hierarchy (pool → vehicle → slot), never decoration.

---

## 2. Design Tokens (the theming contract)

Everything visual derives from tokens. Components never reference raw values — this is what makes "matches any color theme" true.

### 2.1 Color architecture — three layers

```
Layer 1  BRAND INPUT   → one accent hue (--accent) + one neutral tint
Layer 2  SEMANTIC      → --bg, --surface, --surface-2, --border, --text,
                         --text-2, --accent, --on-accent, --ok, --warn,
                         --danger, --info  (derived via color-mix())
Layer 3  COMPONENT     → components consume ONLY layer 2
```

- **Re-theming = changing Layer 1.** Tints, hovers, focus rings and soft backgrounds are computed with `color-mix(in oklab, …)`, so an organization brand (AD Ports teal, or any client color) propagates through every component automatically. No component CSS is ever edited for a re-brand.
- **Light/dark are token swaps, not stylesheets.** `[data-theme="dark"]` remaps the same semantic names; components are written once. Default follows `prefers-color-scheme`; the user override persists.
- **Status colors are fixed semantics** (ok / warn / danger / info) tuned per theme for contrast — they do *not* re-derive from brand, because "expired insurance" must look like danger under every brand.

### 2.2 Contrast floor

Text ≥ 4.5:1, large text and essential icons ≥ 3:1, in **both** themes, verified per brand preset in CI (automated contrast check on the token file). A brand accent that fails contrast for on-accent text automatically flips `--on-accent` between near-white and near-black.

### 2.3 Typography

| Role | Face | Why |
|---|---|---|
| Display / headings | **Space Grotesk** (variable, swap) | Geometric, technical — the world of gantries and containers, not a lifestyle brand |
| Body / UI | **System UI stack** | Zero download for ~90% of rendered text; native rendering quality; a deliberate performance choice |
| Data (plates, IDs, odometer) | **ui-monospace stack** | Character-by-character verification |

Fluid type scale via `clamp()` — six steps from 12px data captions to display, scaling with viewport without breakpoint jumps. Arabic: paired Arabic families declared in the same token slots; the scale and weights hold.

### 2.4 Space, radius, elevation, motion

- **Spacing:** 4px base scale (4·8·12·16·24·32·48·64). Touch targets ≥ 44×44px.
- **Radius:** 6px controls, 12px cards, 999px chips. One family, applied consistently.
- **Elevation:** two shadow levels only (rest, raised). Dark theme uses borders + subtle surface lightening instead of heavy shadows.
- **Motion:** 150ms micro / 250ms panel, one standard easing. Motion communicates state change only — no ambient animation. `prefers-reduced-motion` collapses all transitions to instant.

---

## 3. Layout & Responsiveness

- **App shell:** top bar (identity, search, theme, profile) + content column, max-width 1200px. Fleet console adds a collapsible left rail on ≥1024px.
- **Breakpoints:** 480 / 768 / 1024 / 1440 — but components are container-driven where possible (CSS container queries), so a card is correct in any column, not just any viewport.
- **Mobile order = task order:** on small screens, the booking search comes first, availability second, history last — matching what a phone user came to do.
- **RTL is a first-class mode:** all layout in CSS logical properties (`margin-inline-start`, not `margin-left`); the availability strip and signal bars mirror automatically under `dir="rtl"`.

---

## 4. Component Language (Phase 1 inventory)

Buttons (primary / secondary / quiet / destructive) · Inputs with inline validation · Date-time range picker · Status chip (icon + label, never color-only) · Signal-bar card · Availability strip · Approval stepper · Consent sheet (full-attention modal — the one deliberately interruptive pattern, because consent is the legal gate) · Data table with sticky header · Toast + inline banner · Empty states that invite the next action · Skeleton loaders (structure-shaped, no spinners for content).

**States are designed, not defaulted:** every component ships with hover, focus-visible (2px accent ring, offset), active, disabled, loading, error and empty designed together.

---

## 5. Accessibility Floor (non-negotiable)

WCAG 2.1 AA. Semantic HTML first, ARIA only where HTML can't. Full keyboard path through book → consent → submit. Skip link. Focus visible always. Form errors announced via `aria-live` and linked with `aria-describedby`. Status chips readable by screen readers as text. Hit areas ≥ 44px. Both themes pass contrast per §2.2.

---

## 6. Performance Budget (UX is a performance feature)

| Budget | Target |
|---|---|
| First contentful paint (P75, mid-range Android) | < 1.5s |
| Interaction to next paint | < 200ms |
| CSS (critical, inlined for shell) | < 30KB |
| JS for the booking page | < 50KB — no framework required for Phase 1 pages |
| Web fonts | 1 variable font (display only), `font-display: swap`, preloaded |
| Images | None in the shell; inline SVG icons only |

Techniques: system fonts for body (§2.3) · `content-visibility: auto` on below-fold sections · skeletons over spinners · optimistic UI on booking submit with reconcile-on-error · no third-party scripts in the booking path · availability strip rendered as CSS grid, not canvas or chart library.

---

## 7. Writing in the Interface

Sentence case everywhere. Plain verbs: *Book vehicle · Approve · Hand over · Return*. Blocks name cause and cure: **"Booking unavailable — your licence expired 12 Mar. Renew with HR, then try again."** Empty states invite: **"No bookings yet. Find a vehicle for your next trip."** Same noun for the same thing across every screen (it is always *booking*, never sometimes *reservation*). Numbers formatted per locale; dates always with weekday for pick-ups ("Thu 9 Jul, 09:00") because operational users think in days-of-week.

---

## 8. Theming Proof

The sample page (companion file) demonstrates the entire contract live: four brand presets (Harbor teal · Desert bronze · Signal blue · Port violet) × light/dark = eight appearances from **one CSS file with zero component changes** — switching only Layer-1 tokens.
