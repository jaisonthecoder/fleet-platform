# Fleet Platform — UX Design System & Build Brief

**Version 2.0 · Supersedes `UX_Design_System_Definition.md` (v1.0) · Companion: `07_Page_Functional_Specifications.md`**

---

## 0. How to Use This Document (read this first — especially if you are an AI agent)

This document and its companion, `07_Page_Functional_Specifications.md`, together form the **complete brief** for generating or reviewing any screen in this platform. Use them as follows:

1. **This document** tells you *how everything should look and behave in general*: the visual language, the fixed app shell, the role/scope model, and the reusable interaction patterns (damage mapping, pool/vehicle finder, approval evidence, etc.).
2. **The companion document** tells you *what each specific screen is*: its purpose, its actors, its exact layout regions, its features, its data, its step-by-step user flow, its edge cases, and its states.
3. **Never invent a screen's layout from scratch.** If a screen appears in the companion doc, build exactly what it specifies, using the components and tokens defined here. If a screen does *not* appear there, find the nearest analogous template in §7 of the companion doc and flag the gap rather than guessing.
4. **Every screen reuses the App Shell (§4) unmodified.** Only the content area changes between screens. The header and sidebar are never redesigned per-screen.
5. **Every colour, spacing value, radius and font comes from the tokens in §3.** Never hardcode a hex value, a pixel gap, or a font name inside a component.
6. **There is one visual register, not several.** A booking screen, a fleet-operations console, and an executive dashboard all use the *same* design language — the same card style, the same table style, the same chart style — just at different densities. Do not invent a "darker/more dramatic" theme for operational or executive screens. See §2.3 for what this replaces.
7. When in doubt between two directions, take the quieter, more restrained one. See §2.4, Anti-Patterns.

---

## 1. What This Platform Is (context for the agent)

A group-wide fleet management platform. People use it to: book a pool vehicle, hand a vehicle over and take it back, request and approve a dedicated vehicle, manage the vehicle fleet itself, watch live operations across pools, investigate a fine or accident, and review cost/utilisation/risk at cluster or group level. It replaces spreadsheets and email chains with one system that is fast for a driver in a car park and legible for an executive in a boardroom — **using the same interface language for both.**

Full functional detail — every capability, every rule — lives in the product PRDs (`02_Fleet_Management_Platform_PRD_v3.0.md` and the Phase docs). This document and its companion translate that functionality into screens.

---

## 2. Design Principles

### 2.1 The five rules (unchanged from v1, still load-bearing)

1. **The 2-minute booking.** The core employee journey completes in under two minutes. Every added field or click must earn its place.
2. **Status is never colour alone.** Every state is encoded in icon + label + position, not colour alone — for glare, colour-blindness, and printed handovers.
3. **Blocks explain themselves.** A denial names the cause and the next action. Never vague, never apologetic.
4. **The interface speaks the user's job.** "Book a vehicle," "Hand over," "Approve" — plain verbs, the same verb through the whole flow (a button that says *Approve* produces a message that says *Approved*).
5. **Calm by default, loud on exception.** Normal operation is visually quiet. Visual weight is spent only where a decision or action is needed.

### 2.2 The sixth rule, new in v2: one register, everywhere

Version 1 of this system deliberately used three different "registers" — a calm employee style, a "theatrical" dark operations console, and a "cinematic" executive dashboard. **This is retired.** In practice it produced screens that looked like they belonged to different products (exactly what shows up when you compare a booking screen to a dark neon operations console side by side).

**From v2.0 onward: every screen — employee, fleet manager, line manager, executive — is built from the same light-first, professional visual language**, using the same card, table, chip and chart components. Density changes (an executive dashboard shows more numbers per screen than a booking page); the *language* does not.

### 2.3 What "professional, not AI-generated" means here

AI-generated interfaces cluster around a few recognisable defaults: a warm cream background with a terracotta accent; a near-black background with a single glowing neon accent; or a stark broadsheet layout with hairline rules and zero corner radius. All three are legitimate for the right brief — none is right for this one. **This platform explicitly avoids the near-black-plus-neon-glow look** (which is what the earlier "Fleet Command" dark console drifted into) in favour of a considered, restrained, light-first professional system with a genuinely muted dark mode — not a second, louder theme.

### 2.4 Anti-patterns — do not do these

| Anti-pattern | Why it's excluded |
|---|---|
| Dark, glowing "control room" screens for ops/fleet-lead/executive views | Reads as generic AI sci-fi dashboard, not enterprise software; also fails the "one register" rule |
| Scanlines, radar sweep animations, pulsing glow rings as ambient decoration | Decoration with no information value; costs performance for nothing |
| A different accent colour or corner-radius per screen or per role | Breaks the single design system; the whole point of tokens is one source of truth |
| Colour as the *only* signal for a status | Fails accessibility and glare-readability (principle 2) |
| A dashboard opening with a wall of KPI tiles and nothing else | No thesis, no hierarchy — see the page specs for what each dashboard should lead with |
| Numbered 01/02/03 markers on content that isn't actually sequential | Decoration masquerading as structure |
| Heavy motion/animation on data screens | Motion communicates state change only; ambient animation reads as AI-generated flourish |

---

## 3. Visual Identity & Tokens

Everything visual derives from named tokens, in three layers, so the whole system re-themes from one input and light/dark are a token swap, not two designs.

### 3.1 Colour — the professional palette

| Token | Light value | Dark value | Use |
|---|---|---|---|
| `--ink` | `#10181c` | — | Primary text, headings |
| `--ink-2` | `#54636b` | `#a9b6bc` | Secondary text, captions |
| `--bg` | `#f6f7f8` | `#0d1316` | Page background |
| `--surface` | `#ffffff` | `#151d21` | Cards, panels |
| `--surface-2` | `#eef1f2` | `#1c262b` | Nested surfaces, table stripes |
| `--border` | `#dde3e6` | `#2a353a` | Dividers, card borders |
| `--accent` | `#0e6f66` (harbor teal) | `#4fbdae` | Primary actions, active states, links |
| `--accent-strong` | `#0a5148` | `#7fd4c7` | Hover/pressed states |
| `--accent-soft` | `#e4f2f0` | `#12302c` | Selected rows, soft highlights |
| `--ok` | `#177a4c` | `#3fbf82` | Success, compliant, approved |
| `--warn` | `#9a6a12` | `#e0ab4c` | Caution, expiring, pending |
| `--danger` | `#b8351f` | `#f0725c` | Blocked, expired, declined |
| `--info` | `#1f5fa8` | `#6fa8e0` | Neutral informational |

**Why this palette:** the accent is a muted, professional harbor teal — the same family already validated in your reference screens (images 1, 3, 5) — never neon, never saturated past what a boardroom screen or a sunlit yard can render legibly. Dark mode is a genuinely separate consideration, not "light mode inverted with a glow added": surfaces lighten gently off near-black, the accent desaturates slightly so it never looks like a screensaver.

**Contrast floor:** text ≥ 4.5:1, essential icons ≥ 3:1, in both themes — checked, not assumed.

### 3.2 Typography

| Role | Face | Notes |
|---|---|---|
| Display / headings | **Space Grotesk** (variable) | Used with restraint — headings and key numbers only, never body paragraphs |
| Body / UI | **System UI stack** | No download cost; native rendering quality |
| Data (plates, IDs, odometer, amounts) | **ui-monospace stack** | Anything a human verifies character-by-character |

Fluid type scale via `clamp()`, six steps, no breakpoint jumps.

### 3.3 Space, radius, elevation, motion

- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64px. Touch targets ≥ 44×44px.
- **Radius:** 8px controls, 14px cards, 999px chips — one family, used consistently. (Not zero-radius broadsheet, not the pill-everything look.)
- **Elevation:** two shadow levels only (rest, raised); dark mode uses borders + subtle surface lightening instead of heavy shadow.
- **Motion:** 150ms micro-interactions, 250ms panel transitions, one easing curve. Motion communicates a state change — never ambient. `prefers-reduced-motion` collapses everything to instant.

---

## 4. The App Shell — Fixed Header + Fixed Sidebar

Every authenticated screen uses one shell. It is never rebuilt or restyled per page.

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER  (fixed, 64px, full width, z-index above content)        │
│  [Logo] [Scope Switcher ▾]        [Search]   [🔔] [?] [Avatar ▾] │
├───────────┬─────────────────────────────────────────────────────┤
│           │                                                     │
│  SIDEBAR  │   CONTENT AREA                                      │
│  (fixed,  │   (scrolls independently; max content width         │
│  240px    │    1280px, centered with side padding on ultra-wide)│
│  expanded │                                                     │
│  /72px    │                                                     │
│  collapsed)│                                                    │
│           │                                                     │
└───────────┴─────────────────────────────────────────────────────┘
```

### 4.1 Header (fixed, always visible)

| Region | Contents | Behaviour |
|---|---|---|
| Left | Wordmark/logo + **Scope Switcher** (see §5.2) | Scope switcher only appears for roles with more than one visible scope (hidden for Employee — see §5.1) |
| Centre | Global search (vehicles, bookings, drivers, plate numbers) | `Cmd/Ctrl+K` opens it from anywhere; results grouped by type |
| Right | Notifications bell (badge count) · Help · Avatar menu (profile, theme toggle, sign out) | Notification panel is a slide-over, not a new page |

- Height: **64px fixed**, `position: sticky; top: 0`, background uses `--surface` with a 1px `--border` bottom edge and a subtle backdrop blur when content scrolls beneath it.
- Never scrolls away. Never changes contents based on which page is open, except the page title breadcrumb (see 4.3).

### 4.2 Sidebar (fixed, role-driven contents)

- Width: **240px expanded**, collapsible to a **72px icon rail** (user preference, persisted). On tablet (768–1024px) it defaults collapsed; below 768px it becomes an off-canvas drawer opened by a header menu button (see §8).
- `position: sticky; top: 64px; height: calc(100vh - 64px)`, scrolls independently if its own content is tall (rare).
- Structure: grouped nav items with section labels, active item shown by a filled icon + `--accent-soft` background + left accent bar (never colour alone — label stays visible).
- **Contents are role-driven** — see the mapping table in §5.1. The sidebar is not the same for every user; it is built from a single role→nav-item table, not hand-styled per role.
- Bottom of sidebar (always, every role): a compact organization/environment indicator ("AD Ports Group · Production") and a collapse toggle.

### 4.3 Content area

- Starts with a slim **page header row** (not part of the fixed shell, scrolls with content): breadcrumb / page title (left), primary page action button (right) — e.g. "New Booking," "Onboard Vehicle." This row is the *only* place layout may vary meaningfully between pages; the shell itself never does.
- Max width 1280px, centred, with responsive side padding — prevents line lengths and card grids from stretching absurdly on ultra-wide monitors (an executive's boardroom display, specifically).
- Vertical rhythm: sections separated by 32–48px; cards within a section separated by 16px.

---

## 5. Role & Scope Model

### 5.1 Navigation by role

The sidebar is generated from this single table — one source of truth, not per-role custom builds.

| Nav item | Employee | Fleet Mgr | Line Mgr | Cluster CEO | Fleet Lead | Executive | HR | Data Steward | Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Home / Book a vehicle | ● | | | | | | | | |
| My bookings | ● | | | | | | | | |
| Approvals | | | ● | ● | | | | | |
| Entitlements | ● (submit) | | | ● (decide) | ● (view) | | | | |
| Handover / Return | | ● | | | | | | | |
| Fleet (vehicle registry) | | ● | | | ● | | | ● | |
| Fines & accidents | | ● | | | ● | | ● (view) | | |
| Operations (live map, pool load) | | ● | | | ● | | | | |
| Reports & dashboards | | ● (pool) | | ● (cluster) | ● (cluster/group) | ● (group) | | | |
| Escalations | | | | | | | ● | | |
| Data quality | | | | | | | | ● | |
| Policy engine | | | | | | | | | ● |
| Organization settings | | | | | | | | | ● |

Every nav item respects **scope** in addition to role — a Fleet Manager sees "Fleet," "Fines," "Operations" scoped to the pool(s) they're assigned to; a Cluster Fleet Lead sees the same items scoped to their cluster. This is what the Scope Switcher (§5.2) controls.

### 5.2 The Scope Switcher — pool/cluster/organization selection by privilege

This is the header component that answers "which part of the organization am I looking at right now," and its options are **generated from the user's actual assignments**, never a static list.

**Behaviour by role:**

| Role | What the switcher shows | Default scope |
|---|---|---|
| Employee | Not shown (their pool is implicit from their profile) | — |
| Fleet Manager | Flat list of the pool(s) they manage | Their primary pool |
| Cluster Fleet Lead | The cluster tree: Cluster → its pools, with an "All pools in cluster" option at the top | Cluster-wide view |
| Group Fleet Lead / Executive | Full tree: Group → Clusters → Pools, with "All clusters" default and drill-down | Group-wide view |
| Cluster CEO | Their cluster only, tree of pools within it | Cluster-wide view |
| System Admin | Full tree plus a "Manage hierarchy" shortcut | Group-wide view |

**Interaction:** click opens a panel (not a full page) showing the hierarchy as an indented, searchable tree matching the platform's own Cluster → Pool → Location model. Selecting a node updates every scoped element on the current page (tables, maps, KPI tiles) without a full navigation — an in-place refresh with a brief loading skeleton, not a page reload. The current selection is always visible in the header as a breadcrumb-style label, e.g. `Ports Cluster / Khalifa Port Pool ▾`.

**Rule:** no page ever queries data outside what the current scope + role permit — the switcher's option list *is* the access-control boundary made visible, not a decoration on top of a separately-enforced rule.

---

## 6. Core Components (reference — full detail in the component library, not duplicated here)

Carried over from v1, restyled to the v2 palette: buttons (primary / secondary / quiet / destructive) · inputs with inline validation · date-time range picker · status chip (icon + label, never colour-only) · signal-bar card (slim left-edge colour bar encoding state) · approval stepper · data table with sticky header and row-level actions · toast + inline banner · empty states that invite the next action · skeleton loaders (structure-shaped, no spinners for content). Every component ships with hover, focus-visible (2px accent ring, offset), active, disabled, loading, error and empty states designed together, in both themes.

**Component implementation (recorded decision — to ratify with the UX owner):** the component layer is built with **shadcn/ui** (Radix primitives) + **Tailwind CSS**, with shadcn's theme variables **mapped onto the Layer-2 tokens in §3** — the palette, radius and light/dark contract here stay the single source of truth and **no token values change**. Components are owned in-repo, follow shadcn conventions (`components.json`, `cn()`, `class-variance-authority`), and remain fully **English + Arabic (RTL)** and **light/dark**. Full detail: implementation plan — Frontend Design §16.

---

## 7. Signature Interaction Patterns

These are the platform's distinctive, reusable components — specified once here, used identically wherever they appear in the page specs.

### 7.1 Damage Map / Condition Capture

**What it's for:** marking scratches/damage on a vehicle during handover or return (Phase 1), later comparable against photos by computer vision (Phase 3).

**Layout:** a top-down vehicle outline (simple line-art SVG, generic sedan/SUV/van/bus silhouettes swapped by vehicle body type) rendered in a bordered card. Existing damage from a prior handover shows as filled numbered pins in `--danger`; new pins added this session show in `--accent` until confirmed, then convert to `--danger` on save.

**Interaction:**
1. Tap/click anywhere on the outline → a numbered pin drops at that point.
2. A side panel (desktop: right of the diagram; mobile: below it) lists every pin with a one-line description field and a required photo-attach action.
3. Each pin is editable (drag to reposition, tap to open its detail) and removable before the handover is confirmed.
4. A pin cannot be marked "resolved/removed" without a reason — this becomes part of the audit trail (per FR-HAND policies).

**States:** empty ("No damage pinned"), pins-pending-photo (blocks confirmation until a photo is attached per new pin), confirmed (read-only, timestamped, countersigned).

**Responsive:** on mobile, the diagram is pinch-zoomable; tap targets around each pin are ≥ 44px regardless of the underlying dot's visual size.

### 7.2 Vehicle & Pool Finder

**What it's for:** locating a vehicle — for booking, for fleet management, or for an inspector drill-down — always grouped by the organization's real hierarchy, never a flat unstructured list.

**Layout:** a search/filter bar (plate, VIN, model, driver) above a **grouped, collapsible list**: results cluster under their Pool heading (itself under its Cluster if the current scope spans more than one pool), each group showing a count. Within a pool group, results render as the standard vehicle row/card (status chip, plate in monospace, pool/location, key metric relevant to context — utilisation for fleet management, availability for booking).

**Filter chips:** status (Active/On trip/Maintenance/Blocked), body type, compliance state — combinable, always shown as removable chips above the results so the current filter state is legible at a glance.

**Behaviour:** the Scope Switcher (§5.2) and this finder are linked — changing scope re-groups results; searching within a narrow scope never silently searches outside it (a Fleet Manager typing a plate number never sees a result from a pool they don't manage).

### 7.3 Approval Evidence Card

**What it's for:** giving an approver (Line Manager, Cluster CEO) everything needed to decide without navigating elsewhere — used identically in every approval screen.

**Contents, in fixed order:** requester identity + track record → the concrete ask (vehicle/window/cost) → **system verdicts** (each a small row: icon + statement + one-line reason, e.g. "Eligibility gate passed — licence valid to 02/2027") → justification, quoted → attached evidence/documents → the decision controls.

**Rule:** system verdicts are never hidden behind a "details" click — they are the reason the page exists, shown at full visual weight, ok/warn/danger encoded per §3.1.

### 7.4 Policy Decision Trace

**What it's for:** showing *which rule, which version, which row of the decision table* produced a policy outcome — used wherever the PDP's answer is shown to a human (entitlement decisions, compliance blocks).

**Layout:** a small table showing the matched decision-table row highlighted against the unmatched rows (dimmed), with the rule type, policy version, and evaluation time printed below in monospace. This is a transparency device — it must always be visible next to any eligibility/entitlement/compliance decision, not tucked into a tooltip.

### 7.5 Operations Table & Map (replaces the retired "command console" dark theme)

**What it's for:** the fleet-lead / operations view of live vehicles, alerts and pool load — rebuilt in the v2 professional language.

**Layout:** a light-surfaced card containing a real map (street-level, muted styling, not a radar/sweep effect) with vehicle markers using the same ok/warn/danger status language as everywhere else (small coloured dots with an on-hover label, not glowing halos). Alongside it, an **attention queue** — a plain list of open items ranked by severity and age, each with a named action button — and a **pool-load table** (not a glowing bar chart) showing capacity vs. current bookings per pool, sortable.

**Explicitly not used:** dark background, scanlines, glow/pulse effects, monospace-everything, neon severity bars. This screen must be visually indistinguishable in *language* from the booking page — only denser.

---

## 8. Responsive Rules (explicit)

| Breakpoint | Shell behaviour | Content behaviour |
|---|---|---|
| ≥ 1280px (desktop) | Sidebar expanded (240px) by default | Full multi-column layouts; content max-width 1280px centred |
| 1024–1279px (small desktop / laptop) | Sidebar expanded or user-collapsed | Grids drop from 3 to 2 columns |
| 768–1023px (tablet) | Sidebar **defaults to collapsed icon rail (72px)**, expandable on demand | Grids drop to 1–2 columns; side-by-side panels (e.g. Approval Evidence Card) stack |
| < 768px (mobile) | Sidebar becomes an **off-canvas drawer**, opened by a hamburger icon that replaces the scope switcher's expanded label; header stays fixed at 56px | Single column throughout; tables convert to stacked cards (never horizontal-scroll a data table on mobile except telemetry-style dense grids, which scroll with a sticky first column) |

Container queries are used for individual components (a card is correct in any column width it's placed in) rather than relying solely on viewport breakpoints — this matters because the same Vehicle Finder component, for example, appears both full-width and inside a narrower dashboard panel.

---

## 9. Accessibility & Performance (carried over, unchanged in substance)

**Accessibility:** WCAG 2.1 AA. Semantic HTML first. Full keyboard path through every flow. Visible focus always. Status conveyed as text, not colour alone. Screen-reader-friendly labelling on every icon-only control.

**Performance budget:** FCP < 1.5s (mid-range Android) · interaction-to-next-paint < 200ms · one variable display font, system body font · inline SVG icons, no icon-font · skeletons over spinners · `content-visibility: auto` on below-fold dashboard sections.

---

## 10. Governance

- This document changes only with a version bump and a note of what changed and why (see the header of this file for the pattern).
- `07_Page_Functional_Specifications.md` is the living inventory of every screen; a new screen is not built until it has an entry there.
- Any deviation from the tokens, shell, or anti-patterns in this document — for any role, for any "special" dashboard — requires an explicit, written exception in the companion doc, not a silent one-off in the build.
