# Wayfinder — Design System

> **Status:** v2 — the modern-mix "Helm" **layout** on the **Wayfinder palette**. Single source of
> truth for the visual language. Any agent or engineer building a screen reads this first, then
> builds only from the tokens and components defined here. Do not hardcode colours, fonts, radii, or
> spacing in a component — always consume a token.
>
> **Naming:** the temporary product name is **Wayfinder** (read from `common.appName` in i18n),
> shown with the name-agnostic logo mark + a **"Fleet Platform"** kicker. The name is not final —
> do not scatter it through the codebase or invent new names; change it in one place.

---

## 0. How to use this document

1. **Foundations (§1–§6)** define *how everything looks*: brand, colour tokens, one type family,
   spacing, radius, elevation, motion.
2. **Shell & patterns (§7–§8)** define the fixed app frame and the reusable signature patterns.
3. **Components (§9)** define the building blocks and the states each must ship.
4. **Rules (§10)** are non-negotiable (accessibility, RTL, status-never-colour-alone).
5. Never invent a new colour, font, or radius. If something is missing, add a **token** here first,
   then use it — never a raw value in a component.

---

## 1. Brand idea

**"Harbor wayfinding for people in motion."** Operational software used by a driver at 6 a.m. and an
executive in a boardroom — the *same* language for both, only the density changes.

- **Structure = deep maritime navy.** Calm, authoritative, the frame of every screen.
- **Attention = a warm signal amber.** Used sparingly, like painted wayfinding markings — active
  nav, the selected item, the one thing that needs a decision. Never decorative.
- **Ground = warm neutral paper.** Legible in yard sunlight and on a boardroom display alike.
- **Calm by default, loud on exception.** Visual weight is spent only where an action or a risk is.

### Five product principles (every design decision traces to one)

1. **The 2-minute booking** — speed is the feature for drivers; every field/click must earn its place.
2. **Status is never colour alone** — icon + label + position always accompany colour (§10.2).
3. **Blocks explain themselves** — a denial names the cause *and* the next action.
4. **The interface speaks the user's job** — plain verbs (*Book*, *Hand over*, *Approve*), same verb through the flow.
5. **Calm by default, loud on exception.**

---

## 2. Typography — ONE type family

**IBM Plex Sans — one family, no second typeface and no separate mono face.**

| Slot | Face | Where |
|---|---|---|
| UI, headings, body, labels | **IBM Plex Sans** | Everything |
| RTL (Arabic) | **IBM Plex Sans Arabic** | Auto under `dir="rtl"` — same family, declared in the same token |
| Machine-verifiable data | **IBM Plex Sans + `tabular-nums`** | Plate numbers, IDs, timestamps, amounts, odometer, policy versions — same family, monospaced *figures* only (via `.font-data`) |

**Why one family (decision):** the modern prototype paired Plex Sans with Plex Mono; we deliberately
collapsed to **Sans only**. "Data a human verifies" keeps its distinct rhythm through
`font-variant-numeric: tabular-nums` (the `.font-data` utility), not a second font file. No Mono, no
display face (no Space Grotesk, no Sora).

**Font tokens**

```
--font-sans: 'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif;
/* the "mono" slot maps to Sans so any legacy font-mono utility stays one family */
--font-mono: var(--font-sans);
```

**Type scale (applied through utility classes / component styles):**

| Role | Size / line | Weight | Notes |
|---|---|---|---|
| Display | 44px / 1.05 | 700 | Hero numbers & page titles on cinematic screens |
| Page H1 | 26–30px / 1.15 | 700 | Screen title (content area) |
| Title | 20px / 1.2 | 700 | Header page title |
| Section H2 | 16px / 1.2 | 700 | Section title |
| Body | 14–15px / 1.55 | 400 | Default |
| Data | inherit | 500–700 | `.font-data` — Sans + `tabular-nums` |
| Label / eyebrow | 10.5–12px / 1 | 600–700 | UPPERCASE, `letter-spacing:.08–.1em`, Sans (`.eyebrow`) |

---

## 3. Colour — three-layer token system

```
Layer 1  RAW           exact hex, defined once per theme in :root / .dark
Layer 2  SEMANTIC       --brand, --signal, --ink, --paper, --line, --ok/--warn/--danger/--info, …
Layer 3  COMPONENT      components consume ONLY layer-2 names (mapped onto shadcn vars in @theme inline)
```

Light and dark are a **token swap** (`.dark` remaps the same names), never a second stylesheet. The
palette is the **Wayfinder** brand: maritime navy structure, warm paper ground, gold wayfinding
accent. Status colours are **fixed semantics** tuned per theme for contrast — they do not re-derive
from the brand, because "expired insurance" must read as danger under any future brand.

### 3.1 Semantic tokens (exact hex)

| Token | Role | Light | Dark |
|---|---|---|---|
| `--paper` | Page background | `#F5F3EC` | `#0B3D5C` |
| `--surface` | Cards, panels | `#FFFFFF` | `#0E4A6B` |
| `--surface-2` | Nested surfaces, inputs, tints | `#EEEAE0` | `#12557A` |
| `--surface-hover` | Hover fill | `#E6E1D3` | `rgba(255,255,255,.06)` |
| `--ink` | Primary text | `#10181F` | `#E4EBEF` |
| `--ink-2` | Secondary text | `#5B6572` | `#8FA9B8` |
| `--ink-3` | Tertiary text / kickers | `#8B93A0` | `#6F8598` |
| `--line` | Borders, dividers — **soft warm hairline** | `#E0DACB` | `rgba(255,255,255,.12)` |
| `--field` | Input / strong borders | `#C8BFA9` | `rgba(255,255,255,.2)` |
| `--brand` | Primary actions, links, structure | `#0B3D5C` | `#0E5C7A` |
| `--brand-strong` | Hover/pressed brand | `#0A3350` | `#16729A` |
| `--brand-ink` | Text/icon on brand | `#FFFFFF` | `#FFFFFF` |
| `--brand-soft` | Selected rows, soft highlight | `rgba(11,61,92,.08)` | `rgba(255,255,255,.08)` |
| `--action` | Primary CTA fill (maps to `--color-primary`) | `#0B3D5C` (navy) | `#E2A33D` (gold) |
| `--signal` | Wayfinding accent — active nav, selected, attention | `#E2A33D` | `#E2A33D` |
| `--signal-ink` | Text/icon on signal | `#10181F` | `#10181F` |
| `--rail` / `--rail-ink` / `--rail-muted` | Navy sidebar bg / on-rail text / muted rail text | `#0B3D5C` / `#FFF` / `#CDDCE5` | `#082E47` / `#FFF` / `#8FA9B8` |
| `--plum` / `--plum-tint` | AI / assistant accent (“Ask AI”) | `#5C4A73` / `#EAE4EF` | `#9C86B8` / `rgba(156,134,184,.16)` |
| `--ok` | Success / compliant / approved | `#1F7A4D` | `#7FD39C` |
| `--warn` | Caution / expiring / pending | `#C1791F` | `#E0A94A` |
| `--danger` | Blocked / expired / declined | `#B33F3F` | `#E37A7A` |
| `--info` | Neutral informational | `#0E5C7A` | `#6B9FD6` |
| `--ring` | Focus ring | `#0B3D5C` | `#E2A33D` |

> **Signal vs. warn:** the brand accent (`--signal`, a gold/amber wayfinding marker) and the status
> `--warn` (a more orange amber) are deliberately different hues. Because status is never colour
> alone (§10.2), they are never confused: warn always carries a warning icon + label; signal is a
> structural accent (a left bar, an active dot), never a status.

### 3.2 Soft status backgrounds

Status chips/banners use the status colour at low alpha for fill and border, e.g.
`bg-success/10 border-success/30 text-success`. Do not create new hex tints — use alpha on the token.

### 3.3 Contrast floor

Text ≥ 4.5:1, large text & essential icons ≥ 3:1, in **both** themes. Verify, don't assume.

---

## 4. Space & layout

- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px (Tailwind default). Touch targets ≥ 44×44px.
- **Content max-width:** 1180px, **left-aligned** after the sidebar (not centred), with responsive
  side padding (`px-5` → `md:px-[34px]`, `pt-7 pb-16`).
- **Vertical rhythm:** sections ~28px apart; cards within a section ~14px apart.
- **RTL is first-class:** use logical properties (`ms-*`/`me-*`, `start`/`end`, `ps/pe`, `border-e`),
  never `left`/`right`. The shell, signal bars and availability strip mirror automatically under `dir="rtl"`.

## 5. Radius, elevation, borders

- **Radius:** `--radius` = **3px** (sharp, editorial) — controls, inputs, chips. Cards/tiles use 2–6px
  explicitly. Avatars/dots = full circle. One family, applied consistently.
- **Borders:** a single **soft warm hairline** (`--line` `#E0DACB`). Never a hard ink line. The base
  default is set in `@layer base { *,::before,::after { border-color: var(--color-border) } }` so
  Tailwind `border-*` utilities still win — do **not** write an unlayered `*{border-color}` rule
  (it falls back to `currentColor` and prints heavy dark borders).
- **Elevation:** two levels only — `--shadow-rest` (cards) and `--shadow-raised` (popovers/sheets).
  Dark mode leans on borders + surface lightening rather than heavy shadow.
- **Scrollbars:** thin (10px) rounded pill, never the stock OS control. Track transparent, thumb
  `--field` (hover `--ink-3`) — both already flip per theme. The navy rail is the one exception:
  it stays dark chrome in both themes, so `.bg-rail` gets a translucent white thumb instead. Set
  globally in `index.css` (`scrollbar-width`/`scrollbar-color` + `::-webkit-scrollbar-*`, inside
  `@layer base` so it can't be beaten by an unlayered rule) — no per-component styling needed.

## 6. Motion

- `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`.
- 150ms micro-interactions · 250ms panel transitions. Motion communicates a **state change** only —
  no ambient animation (no radar sweeps, no scanlines, no pulsing glows as decoration).
- `prefers-reduced-motion: reduce` collapses all transitions/animations to instant.

---

## 7. App shell (modern-mix layout)

Every authenticated screen uses one shell; it is never rebuilt per page. Layout = flex row (sidebar +
content column); the sidebar is sticky full-height, the header is sticky at the top of the column.

```
+----------+--------------------------------------------------------+
| SIDEBAR  | HEADER (68px): eyebrow / Page title   Ask-AI  bell theme AR avatar |
| (navy)   +--------------------------------------------------------+
| logo     | CONTENT (scrolls; left-aligned, max-width 1180px)      |
| section  |   eyebrow . title . subtitle                           |
| nav      |   page body                                            |
| profile  |                                                        |
+----------+--------------------------------------------------------+
```

- **Sidebar (navy `--rail`):** expanded **264px** / compact **72px**; collapsible, **persisted**
  (`wf-sidebar-collapsed`), toggled by the footer button **or `Ctrl/⌘-B`**; off-canvas drawer < 768px.
  - **Brand lockup:** the name-agnostic mark in a subtle `white/10` tile + wordmark (`common.appName`)
    + "Fleet Platform" kicker (rail-muted). Compact = mark only.
  - **Section label** (rail-muted, uppercase) — the operations group.
  - **Nav** from one role→item table (single source): icon + label; **active = solid gold
    (`--signal`) tile, ink text**; inactive = rail-muted, hover `white/10`. Compact = icon-only tile +
    tooltip. Disabled (not-yet-built) items are dimmed and non-interactive. Active state is computed
    with `useMatch` — never a function `className` under a Radix `asChild` trigger (Slot stringifies it).
  - **Footer:** "View driver mobile app" (dashed) + profile card (avatar + name + emp id) + collapse toggle.
- **Header (68px, sticky):** breadcrumb **eyebrow** (register/scope) + **page title** on the start
  side; end side = **Ask AI** (plum), notifications (bell + dot), theme toggle, language toggle,
  avatar — bordered 38px controls. Brand appears in the header **only on mobile** (with the hamburger),
  since on desktop it lives in the sidebar. Never duplicate the wordmark across sidebar + header on desktop.

### 7.1 Registers, one language

The same tokens/components render at different densities — **the language never changes, only density.**

| Register | Surface | Where | Character |
|---|---|---|---|
| **Calm** | paper/white | Booking, Handover, Approvals, Policy, Fines | Generous whitespace, one clear action |
| **Operational** | paper/white, denser | Fleet registry, ops | More rows/KPIs per screen, same cards & tables |
| **Cinematic / navy** | navy surface (= dark theme) | Executive dashboard, Entitlement decision | Large numbers, restrained motion, one story |

> The navy world is the **dark theme** (Entitlement-decision register). It uses the **same** cards,
> chips, tables and type — never a neon "control room": no glow, no scanlines, no radar sweeps (§6, §10).

---

## 8. Signature patterns (reusable, specified once)

- **Status chip** — icon + label pill; tones ok/warn/danger/info/neutral. Never colour-only.
- **Signal-bar card** — a card with a slim start-edge colour bar encoding state (like painted berth markings).
- **Availability strip** — the day's vehicle slots as a berth-occupancy bar: time flows start→end
  (mirrors in RTL), occupied = solid, buffer = hatched, free = outlined/bookable. The one memorable element.
- **Approval evidence card** — fixed order: requester + track record → the ask → **system verdicts
  (icon + statement + one-line reason, at full weight)** → justification → evidence → decision controls.
- **Policy decision trace** — the matched decision-table row highlighted against dimmed rows, with
  rule type + policy version + eval time in mono. Always visible beside any policy outcome, never in a tooltip.
- **Damage map / condition capture** — top-down vehicle outline; tap to drop numbered pins; each pin
  requires a note + photo before confirmation.
- **Vehicle & pool finder** — search + removable filter chips over results grouped by the org
  hierarchy (Cluster → Pool).
- **Booking search + occupancy timeline** — a search form card (destination / pick-up / return /
  passengers) above a per-vehicle **occupancy timeline** (open / your-booking / booked segments, with
  a legend) and a grid of **eligible-vehicle cards** (plate badge, spec row, availability chip, fuel
  estimate, Book). Calm register. Reference implementation: `features/booking/book-vehicle-page.tsx`.

---

## 9. Component inventory & required states

Built on **shadcn/ui (Radix) + Tailwind v4**, themed via the tokens above (shadcn variables are
mapped onto layer-2 tokens; token values are the source of truth).

Primitives: Button (primary / secondary / quiet / destructive) · Input + inline validation · Select ·
Textarea · Label · Date-time range picker · **StatusChip** · **SignalCard** · **AvailabilityStrip** ·
Badge · Approval stepper · Data table (sticky header, row actions) · Card · Dialog · Sheet (slide-over) ·
Tooltip · Alert (inline banner) · Toast · Skeleton (structure-shaped, no spinners) · Empty state ·
**PageHeader** · **Eyebrow/section label**.

**Every component ships all states, designed together, in both themes:** default · hover ·
**focus-visible (2px `--ring`, 2px offset)** · active · disabled · loading · error · empty.

---

## 10. Non-negotiable rules

1. **Tokens only.** No raw hex/px for colour, font, radius in components.
2. **Status is never colour alone.** Always icon + text (+ position). Verified for colour-blindness and grayscale.
3. **One type family** — IBM Plex Sans (+ Sans Arabic). No Mono, no second typeface; data uses `.font-data` (Sans + `tabular-nums`).
4. **RTL parity.** Logical properties only; every screen works identically in English and Arabic.
5. **WCAG 2.1 AA.** Semantic HTML first; full keyboard path; visible focus; icons labelled.
6. **No AI-generated clichés.** No neon-on-black control room, no glow/scanline/radar decoration, no
   per-screen accent or radius, no wall-of-KPIs with no thesis, no fake "01/02/03" numbering on
   non-sequential content.
7. **One name, one mark, temporary.** Product name comes from `common.appName` only; the mark is
   name-agnostic. Do not hardcode or multiply names — the name is not decided.

---

## 11. Performance budget

FCP < 1.5s (mid-range Android) · INP < 200ms · one type family, `font-display: swap` · inline SVG
icons only (lucide) · skeletons over spinners · `content-visibility:auto` on below-fold dashboard
sections · no ambient animation.

---

## 12. Governance

This document changes only with a version note. A screen is not built until its pattern exists here
or is added here first. Any deviation for a "special" screen requires a written note in this file,
not a silent one-off in code.
