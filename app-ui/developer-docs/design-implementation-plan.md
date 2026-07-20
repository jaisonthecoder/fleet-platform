# Wayfinder UI — Design Setup & Implementation Plan

> Companion to `design-system.md`. This is the **phase-by-phase** plan to build `app-ui` on the
> **Wayfinder palette + modern-mix "Helm" layout**. Each phase has a goal, concrete tasks, and an
> exit checklist.
>
> **Layout direction:** the shell (navy collapsible sidebar with logo lockup + section label +
> labelled icon nav + profile card, and a 68px breadcrumb/title header with Ask-AI / notifications /
> theme / language / avatar) follows the modern-mix **Helm** prototype
> (`Business-INTAKE/Carpool_modern_mix/Helm.dc.html`) **re-skinned to the Wayfinder palette** — copy
> its layout / aesthetics / content / alignment, **never its colours** (navy #0B3D5C, gold #E2A33D,
> warm paper, soft warm border #E0DACB stay).

---

## Phase 0 — Foundation reset (tokens, type, brand) — *done*

**Goal:** stand up the token system, one font family, and the Wayfinder brand, so every component re-skins automatically.

**Tasks**
- [x] Author `design-system.md` (design language) and this plan.
- [x] `src/index.css` = three-layer exact-hex token system (light + dark), 3px radius, shadow,
      motion, `prefers-reduced-motion`, focus-visible. Soft warm border `#E0DACB` via `@layer base`.
- [x] **Single** type family — IBM Plex Sans (+ Sans Arabic); no Mono (`--font-mono: var(--font-sans)`),
      data uses `.font-data` (Sans + `tabular-nums`).
- [x] Product name centralised in `common.appName` ("Wayfinder"); name-agnostic logo mark + kicker.
- [x] Added tokens: `--ink-3`, `--surface-hover`, `--plum`/`--plum-tint`, `--rail`/`--rail-muted`.

**Exit checklist**
- [x] App builds; light/dark + EN/AR (RTL) render with the palette; no second typeface; borders are the soft warm hairline.

**Production follow-up (tracked, not blocking design check):** migrate fonts from the CDN stylesheet
link to self-hosted `@fontsource/ibm-plex-*` once the toolchain matches the repo's pinned
`pnpm@11.13.1` (current environment pnpm is older; installing would rewrite the lockfile). Self-hosting
removes the external font dependency (relevant for UAE data-residency and offline yards).

---

## Phase 1 — Primitive & pattern library — *mostly done*

**Goal:** every building block from `design-system.md §9` exists, themed, with all states, in both themes and RTL.

**Tasks**
- [x] shadcn primitives on the tokens: Button (variants incl. `signal`), Input, Select, Textarea,
      Label, Card, Dialog, Sheet, Tooltip, Alert, Table, Skeleton, Badge.
- [x] Signature components: **StatusChip**, **SignalCard**, **AvailabilityStrip**, **PageHeader**, **Eyebrow/section label**.
- [ ] Add missing primitives: Toast, Empty state, Approval stepper, Date-time range picker.
- [x] focus-visible (2px ring + offset) global; disabled/hover states on primitives.

**Exit checklist**
- [x] `/:lang/design` showcase renders every primitive + pattern in both themes and RTL.
- Keyboard path and visible focus verified on interactive components.

---

## Phase 2 — App shell, nav, role model — *done (shell); scope/role deferred*

**Goal:** the modern-mix shell frame is real.

**Tasks**
- [x] Navy sidebar (Helm layout): logo lockup + kicker, section label, role→item single-source nav
      (icon + label, active gold tile), profile card, "View driver mobile app".
- [x] Collapsible rail — expanded 264px / compact 72px icon-only + tooltips, **persisted**
      (`wf-sidebar-collapsed`) + `Ctrl/⌘-B`; off-canvas drawer < 768px (closes on navigate).
- [x] 68px header: breadcrumb eyebrow + page title; Ask-AI (plum), notifications, theme, language, avatar.
- [x] Skip-to-content link; sticky header; flex layout (no fixed-offset math).
- [ ] **Deferred:** functional Scope Switcher (Cluster → Pool), `⌘K` search palette, notification
      slide-over, avatar menu, and the role model that drives which nav items show.

**Exit checklist**
- [x] Sidebar collapse/expand persists; active nav = gold; light/dark + RTL correct; verified in-browser.
- Scope/role wiring — deferred to when the backend/role model lands.

---

## Phase 3 — Calm register screens (employee + operational) — *in progress*

**Goal:** the highest-traffic journeys, built for the business (modern-mix layout, Wayfinder palette).

**Screens (follow the Helm content/layout; Wayfinder palette):**
- [~] **Book a vehicle** — search form + occupancy timeline + eligible-vehicle cards done
      (`features/booking/book-vehicle-page.tsx`, route `/:lang/booking`). Next: interruptive consent → confirmed.
- [ ] **My bookings** — upcoming/active/past; act on upcoming.
- [ ] **Handover & return** — identity, walkaround checklist, odometer (telematics hint), fuel gauge,
      damage map, signature, readiness gate.
- [ ] **Vehicle registry (Fleet)** — finder grouped by hierarchy, inspector panel.
- [ ] **Compliance & alerts** — expiry ladders, hard-block explanations.

**Exit checklist**
- 2-minute booking path works end-to-end on mock data; consent is non-skippable; blocks explain themselves.

---

## Phase 4 — Approvals & policy (evidence-led)

**Screens:**
- [ ] **Approval inbox** (Line Manager) — queue + approval-evidence card + system verdicts.
- [ ] **Entitlement decision** (Cluster CEO) — track record, cost breakdown + alternative + break-even,
      approval chain, covenant, policy decision trace. *(Cinematic navy header allowed.)*
- [ ] **Policy engine authoring** — decision-table editor, effective dates, dry-run, versioning.
- [ ] **Fines & black points** — auto-attribution, recovery pipeline, HR-escalation threshold.

**Exit checklist**
- Every policy/eligibility outcome shows a **policy decision trace**; SoD note present on approvals.

---

## Phase 5 — Cinematic register (executive & live ops)

**Screens:**
- [ ] **Executive dashboard** — headline thesis, KPI cells with trends, cost-trend chart, spend
      composition, ESG rings, ranked AI recommendations (flag, don't auto-act).
- [ ] **Operations / live map** — light map with ok/warn/danger markers, attention queue with
      per-item actions, pool-load table. *(No radar/scanline/glow.)*

**Exit checklist**
- Dashboards lead with a thesis, not a wall of tiles; ops screen uses the same language as booking, only denser.

---

## Phase 6 — Cross-cutting polish

**Tasks**
- [ ] Empty/loading/error states for every screen; skeletons.
- [ ] Full RTL + Arabic copy pass; locale-aware numbers/dates.
- [ ] Accessibility audit (keyboard, contrast per theme, screen-reader labels).
- [ ] Performance budget verification (FCP/INP, font strategy, `content-visibility`).
- [ ] Self-host fonts (Phase 0 follow-up) once toolchain allows.

**Exit checklist**
- WCAG 2.1 AA pass; both themes pass contrast; performance budget met.

---

## Working conventions

- Tokens only; no raw values in components (see `design-system.md §10`). Borders use the token
  hairline via `@layer base` — never an unlayered `*{border-color}` (prints heavy dark borders).
- One type family (IBM Plex Sans + `tabular-nums` for data); one name from `common.appName` + name-agnostic mark.
- Follow the modern-mix **Helm** layout/aesthetics/content/alignment, **re-skinned to the Wayfinder
  palette** — copy structure, never Helm's colours.
- Update `design-system.md` **before** introducing a new pattern in code.
