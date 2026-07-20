# Fleet Platform — Page & Flow Functional Specifications

**Version 1.0 · Companion to `06_UX_Design_System_v2.md` · Read that document first**

---

## 0. Purpose & How to Read This Document

This is the **full functional context for every screen** in the platform — what an AI build/design agent (or a human designer or engineer) needs in order to generate a correct, complete screen without guessing. Every entry follows the same fixed template so it can be scanned or parsed consistently:

```
Route            — where it lives in the app
Actor(s)         — who uses it (role from the design system's role table)
Purpose          — one sentence, why this screen exists
Access rule      — which role + scope combination can see/act on it
Shell            — confirms it uses the standard App Shell (§4 of the design system)
Layout regions   — the specific regions inside the content area, top to bottom / left to right
Key features     — the concrete things the screen does
Data shown       — the fields/entities on screen
User flow        — the numbered step-by-step path through the screen
Use cases & edge cases — the situations the screen must handle, not just the happy path
States           — empty / loading / error / success, specifically for this screen
Responsive notes — anything beyond the design system's default responsive rules
```

All screens use the fixed App Shell (header + sidebar, §4 of the design system) and the Scope Switcher (§5.2) — these are **not repeated per page** below; only what's specific to each page is described.

---

## PART A — EMPLOYEE / DRIVER

### A1. Book a Vehicle

```
Route            /book
Actor(s)         Employee / Driver
Purpose          Let an employee find and book an eligible pool vehicle in under 2 minutes.
Access rule      Any authenticated employee; scope is always their own home pool (no switcher).
Shell            Standard shell. Scope switcher hidden for this role.
```

**Layout regions:**
1. Page header row: "Where to today?" + the employee's name/pool as context, no primary action button (the form below is the action).
2. A **4-step horizontal stepper** fixed at the top of the content card: `WINDOW → VEHICLE → CONSENT → CONFIRMED`. Current step highlighted; completed steps show a check, not just colour.
3. Step content card, one step visible at a time (not an accordion — a genuine wizard, back/forward navigable).
4. **Step 1 — Window:** date (defaults today), time-window quick-picks (e.g. 08:00–10:00, 10:00–13:00, 13:00–17:00, Full day) plus a custom range option, vehicle category filter (Sedan/SUV/Van/Pickup), destination/purpose free text, passenger count. Primary action: "Search available vehicles."
5. **Step 2 — Vehicle:** results as the **Vehicle & Pool Finder** pattern (design system §7.2) filtered to bookable + eligible vehicles only; each result shows availability window, estimated fuel, distance from the employee's location. Selecting one advances to consent.
6. **Step 3 — Consent:** the **Consent Sheet** (see A3) rendered inline in this step, not a separate popup — full attention, cannot be skipped or scrolled past without reading (design intentionally interruptive here, per the platform's non-negotiable consent rule).
7. **Step 4 — Confirmed:** booking number, key handover instructions, calendar-add action, "Book another" and "View my bookings" links.

**Key features:** buffer-aware availability (a vehicle mid-buffer after another booking is shown as unavailable with a "free from HH:MM" note, not hidden); waitlist join when no vehicle matches; smart recommendation ordering (proximity, fuel efficiency, suitability) — recommended vehicle visually first, not separately labelled "AI pick" (no badge theatre).

**User flow:**
| # | Step | System response |
|---|---|---|
| 1 | Employee sets window + filters, taps Search | Eligibility gate runs silently; ineligible employees see a full-width banner explaining why (per design system principle 3) instead of results |
| 2 | Employee selects a vehicle | Advances to Consent step, request context (vehicle, window) carried forward |
| 3 | Employee reads and signs consent | "Confirm booking" enabled only once consent is signed |
| 4 | Employee confirms | Booking created, routes to Line Manager approval; Step 4 shown regardless of approval status (booking exists, pending approval) |

**Use cases & edge cases:** no vehicles available → waitlist offer, not a dead end. Employee is blocked (expired licence / black-points overdue) → Step 1 never lets them proceed past search; banner names the reason and the fix. Requested window conflicts with an existing personal booking → warn but allow (business decision, not a hard block). Employee returns to Step 1 after selecting a vehicle → consent state is discarded, must re-consent if parameters changed materially (per platform consent-tolerance rules).

**States:** empty results (offer waitlist + suggest widening the window) · loading (skeleton vehicle cards, not a spinner) · error (network/eligibility-service failure — explicit retry, never a silent blank step).

**Responsive:** stepper collapses to a compact progress dots + current step label under 768px; vehicle results go single column.

---

### A2. My Bookings

```
Route            /bookings
Actor(s)         Employee / Driver
Purpose          See upcoming, active and past bookings; act on upcoming ones.
Access rule      Own bookings only.
```

**Layout regions:** tab row (Upcoming / Active / Past); list of booking rows (date/time block, vehicle + plate, status chip, quick actions). Active booking (if any) is pinned above the tabs as a highlighted card with "Extend" and live status.

**Key features:** cancel/modify an upcoming booking (re-triggers consent if materially changed); extend an active booking (checks the next booking + buffer on that vehicle, per platform rules — approve automatically if clear, else route to fleet manager); view consent record for any booking; download/print handover receipt for past bookings.

**User flow:** employee lands on Upcoming by default → taps a booking → detail panel slides in (not a new page) with full trip detail, consent reference, and available actions for that status.

**Use cases:** attempting to cancel after the vehicle has already been collected → offer "report early return" instead, not a blind cancel. Extension conflicts with the next booking → clear message naming the conflicting booking, offer to notify the fleet manager instead of silently failing.

**States:** empty (no bookings yet → "Find a vehicle for your next trip" with a direct link to A1).

---

### A3. Consent Sheet

```
Route            (rendered inline within A1 Step 3, and within the Entitlement flow for dedicated vehicles)
Actor(s)         Employee / Driver, or the assigned driver on a dedicated-vehicle entitlement
Purpose          Capture legally binding, non-skippable consent before any booking number or allocation is issued.
```

**Layout:** full-attention panel (not a tiny checkbox at the bottom of a form) — the consent text is the dominant visual element, plain language, in the user's selected language (EN/AR), summarising: responsibility for fines/tolls during the booking, responsibility for damage, and commitment to usage policy and traffic law. Below it: an explicit "I have read and agree" action (not pre-checked), and the immutable metadata that will be recorded (name, timestamp, device — shown for transparency, not editable).

**Key features:** version-stamped (shows which policy version is being agreed to); re-consent triggers automatically and visibly (a small "this replaces your previous consent because the vehicle changed" note) if the underlying booking changed beyond tolerance.

**Use cases:** employee attempts to navigate away mid-consent → standard "unsaved changes" style warning, since an unsigned consent means no booking. Policy version changes between opening and submitting → force a refresh of the displayed text before allowing submission.

---

## PART B — FLEET MANAGER

### B1. Vehicle Handover

```
Route            /handover/:bookingId
Actor(s)         Fleet Manager
Purpose          Verify identity, inspect the vehicle, capture condition, and hand over keys — completely, before release.
Access rule      Fleet Manager scoped to the pool the vehicle belongs to.
```

**Layout regions (top to bottom, single scrolling flow with a numbered progress rail):**
1. **Identity banner** (dark-on-light emphasis card, not full dark theme): driver name/photo-initial, employee ID, licence validity, plate number large in monospace, eligibility-gate and consent status shown as confirmed chips.
2. **1 — Walkaround inspection:** checklist rows (Body & glass, Tyres & spare, Lights & indicators, On-vehicle assets, Cabin condition), each with PASS/FAIL toggle; a FAIL requires a note.
3. **2 — Odometer & fuel:** odometer numeric input pre-filled from telematics where available (with a "telematics reads X, confirm or override" hint per the platform's odometer-conflict rule) + a draggable fuel-level slider showing fraction (e.g. ⅞) and estimated litres.
4. **3 — Damage map:** the **Damage Map / Condition Capture** component (design system §7.1) in full.
5. **4 — Driver acknowledgement:** signature capture pad, with a note confirming the booking consent already on file and clarifying this new signature covers condition acceptance specifically.
6. Sticky bottom action bar: live readiness summary ("2 items left: 1 check, signature") + primary "Hand over keys" button, disabled until every required item is complete.

**Key features:** each section shows a completion state in its header (count, or a status label) so the fleet manager always knows what's left without scrolling. All four sections are reachable at any time (not strictly gated step-by-step) except the final action, which requires all four complete.

**User flow:** fleet manager opens the handover from a booking notification or the day's handover queue → completes sections in any order → confirms → vehicle status flips to "In use," key-custody record updates, driver notified.

**Use cases & edge cases:** a FAIL on walkaround (e.g. a light out) → flag for maintenance without necessarily blocking handover (fleet manager judgement, but the flag is logged); odometer conflicts with telematics beyond tolerance → visible warning, both values retained, does not block; no telematics available for this vehicle → odometer field behaves as plain manual entry, no false "matched" claim.

**States:** offline/degraded connectivity — this screen must work with local capture and background sync (a yard has poor signal); a clear "saved locally, will sync" indicator when offline.

**Responsive:** this is a field screen — optimise for tablet held one-handed as much as desktop. Damage-map diagram and its pin list stack vertically under 1024px.

---

### B2. Vehicle Return

```
Route            /return/:bookingId
Actor(s)         Fleet Manager
Purpose          Mirror of Handover — capture end-of-trip odometer, fuel, condition, and reconcile against expectation.
```

**Layout:** same structure as B1 (identity banner, odometer/fuel, damage map showing handover-state pins as a baseline for comparison, no new signature needed from the driver unless damage is newly found). Adds a **reconciliation card**: expected vs. actual fuel consumption, on-time vs. late flag, both computed and shown plainly (not buried).

**Key features:** returns outside the booked window are flagged automatically and visibly (feeds behaviour tracking); fuel deviation beyond the configured threshold is flagged as advisory, never blocking; new damage found at return triggers the same pin-plus-photo-plus-reason flow as handover, and is visually distinguished from carried-over damage.

**Use cases:** vehicle returned to a different location than expected → note it, don't block. Key not physically returned (lost) → explicit "report lost key" action from this screen, starting the key-custody workflow rather than silently leaving the booking open.

---

### B3. Fleet (Vehicle Registry)

```
Route            /fleet
Actor(s)         Fleet Manager, Fleet Lead, Data Steward (edit rights vary by role)
Purpose          The manifest of every vehicle in the fleet manager's scope — find, inspect, manage.
Access rule      Scoped by the Scope Switcher; Fleet Manager sees their pool(s), Fleet Lead sees their cluster/group.
```

**Layout regions:**
1. Page header: "Fleet" + primary action "Onboard vehicle" (role-gated).
2. **Vitals strip:** a row of compact stat cards — fleet size, bookable now, in maintenance, compliance blocks, data completeness — using the standard card style (not a neon KPI wall).
3. **Vehicle & Pool Finder** (design system §7.2) in full: search + filter chips + grouped, collapsible results by pool.
4. Selecting a vehicle opens an **inspector panel** (right-side on desktop ≥ 1024px, full-screen sheet on mobile/tablet) showing: identity + lifecycle-state pills, telemetry summary (odometer, GPS status), compliance runway (a small set of labelled bars showing days-to-expiry per document type, colour per §3.1 semantics), cost & risk mini-stats, and role-gated actions (Transfer pool, Schedule maintenance, View documents, Start off-hire).

**Key features:** the compliance runway makes a hard-blocked vehicle immediately obvious (a filled `--danger` bar + explicit "no bookings until renewed" note) rather than requiring a click to discover. Data-completeness stat links directly to the Data Steward's queue for that record if incomplete.

**Use cases:** vehicle has no telematics → the telemetry summary explicitly states "Not tracked" rather than showing an empty/broken widget. Vehicle recently transferred between pools → lifecycle history accessible from the inspector, not hidden.

**Responsive:** on mobile, the inspector fully replaces the list view (no split-pane) with a clear back action.

---

### B4. Fines & Accidents Register

```
Route            /fines
Actor(s)         Fleet Manager (create/edit), HR (view), Finance (view costs)
Purpose          Record and track fines and accidents, see auto-attribution to driver/booking, and track recovery.
```

**Layout regions:** tab row (Fines / Accidents / Recovery); a filterable table (driver, vehicle, date, amount, status); "Record a fine" primary action opens a form pre-filled by plate/date lookup that shows the **auto-matched booking and driver** as soon as enough detail is entered, with a clear "matched to BK-XXXX / Driver Name" confirmation the fleet manager reviews rather than blindly trusts.

**Key features:** a fine with no matching booking shows explicitly as "No active booking — attributed to assigned driver" rather than silently guessing; disputed fines are visually distinct (a `--warn` state, not removed from the list); repeat-offender threshold breach (e.g. 3rd fine in the rolling window) shows an inline badge on the driver's row, linking to the HR escalation view (H1).

**Use cases:** a substitute-driver window was active at the time of the fine → attribution shows the substitute, not the assigned driver, with the window dates visible for audit.

---

### B5. Live Fleet Map (Operations)

```
Route            /operations
Actor(s)         Fleet Manager, Fleet Lead
Purpose          See where vehicles are right now, spot deviations, and act on the day's open issues — in the professional design language, not the retired dark console.
```

**Layout:** exactly the **Operations Table & Map** pattern (design system §7.5) — light map card + attention queue + pool-load table, laid side by side on desktop, stacked on tablet/mobile with the attention queue prioritised above the map on small screens (the queue is actionable; the map is contextual).

**Key features:** clicking a vehicle on the map opens the same inspector panel used in B3, so "where is this vehicle" and "what is this vehicle" are one consistent interaction, not two different components. Attention-queue items link directly to the relevant action screen (a compliance alert links to B3's inspector; a fine links to B4).

---

## PART C — LINE MANAGER / APPROVER

### C1. Approval Inbox

```
Route            /approvals
Actor(s)         Line Manager, Delegate Approver
Purpose          Decide on pending booking and entitlement-endorsement requests quickly and with full evidence.
```

**Layout regions:** left column — request queue (urgency-sorted, SLA timer per item, signal bar per §6 card style); right column — the **Approval Evidence Card** (design system §7.3) for the selected request, ending in decision controls (Approve / Request change / Decline, decline requires a reason).

**Key features:** queue supports Pending/Decided tabs; selecting a queue item updates the evidence card without a page reload; SoD is enforced structurally — a request the approver themselves raised never appears in their own queue (routes to their delegate instead), and this is stated in the decision panel's footer for transparency, not hidden.

**Use cases:** approver has an active delegation running → banner clarifies items are being co-handled; a request needs modification, not outright decline → "Request change" returns it to the requester with the approver's note attached, staying in a visible "Returned" sub-state rather than disappearing from the queue.

**States:** empty queue → calm confirmation ("You're caught up"), not a blank page.

---

## PART D — CLUSTER CEO / SENIOR APPROVER

### D1. Entitlement Decision

```
Route            /entitlements/:requestId
Actor(s)         Cluster CEO (or configured senior approver)
Purpose          Make the final, policy-gated decision on a dedicated-vehicle entitlement request, in under two minutes of reading.
```

**Layout regions:**
1. Header block: requester identity + role/grade/tenure context, the concrete ask (vehicle class, duration, location), cost of the ask shown prominently (not buried in a table).
2. **Approval chain stepper:** prior approvers shown completed with their names/dates; the CEO's own step shown as pending/active.
3. **Policy Decision Trace** (design system §7.4): the matched eligibility rule row, explicitly including the reason this request escalated all the way to the CEO (e.g. "duration exceeds the 12-month auto-approve threshold") — this is not optional detail, it is the core justification for the screen existing.
4. Justification card: the requester's stated reason, quoted, plus any endorsing manager's added note.
5. Attached evidence/documents, as a simple linked list.
6. Cost breakdown: a small, clearly labelled bar or table (lease/fuel/insurance/tolls) with an explicit comparison to the pool-usage alternative — this is the financial half of the decision and must be as visible as the policy half.
7. Decision dock (sticky bottom bar, same pattern as B1): Approve as requested / Approve with a modified duration / Decline (with required reason).

**Use cases:** request includes a professional (non-employee) driver → their eligibility record is shown alongside the requester's. Threshold that caused escalation is itself close to a boundary case (e.g. 13 months vs a 12-month threshold) → this nuance is visible in the Policy Decision Trace, not smoothed over.

**Design constraint (explicit):** this screen must NOT use a dark theme. It replaces the earlier dark-blue entitlement mockup entirely — light surfaces, the same card/table language as every other screen, per §2.2 of the design system.

---

## PART E — CLUSTER / GROUP FLEET LEAD

### E1. Fleet Operations Console

Identical in content and purpose to **B5 (Live Fleet Map)**, at a wider scope (cluster or group, via the Scope Switcher) with an added **cross-pool comparison table** (utilisation, cost/km, open issues per pool) above the map, so a fleet lead's first view is comparative, not just a single map. Uses the same Operations Table & Map pattern — no separate "command centre" screen or theme exists.

---

## PART F — EXECUTIVE

### F1. Executive Dashboard

```
Route            /dashboard/executive
Actor(s)         Executive (GCEO/GCDIO/GCFO/GCHRO)
Purpose          A two-minute read of group-wide utilisation, cost, risk and ESG, with drill-down.
```

**Layout regions:**
1. **Thesis header:** one plain-language sentence stating the headline finding for the period (e.g. "Cost per kilometre is down 6.2% this month"), styled prominently but with the same type system as everywhere else — not a giant gradient hero.
2. **Stat strip:** utilisation, cost/km, fines-attribution rate, compliance-breach count — compact cards, same style as B3's vitals strip (consistency across levels of the org, not a different look for executives).
3. **Cost trend chart:** line/area chart, cost per km over 12 months, with a plain annotation marking any notable inflection (e.g. the month a right-sizing action landed) — the chart explains itself in words, not just a legend.
4. **Composition breakdown:** where the money goes (lease/fuel/maintenance/tolls) as a simple, clearly labelled chart plus a legend table with numbers (not colour-only).
5. **ESG summary:** CO₂ vs. prior year, EV/hybrid share — two or three simple stat blocks, not decorative rings for their own sake unless the ring is the clearest way to show "% of target" (acceptable if plainly labelled).
6. **AI recommendations list:** each recommendation as a plain card — action, evidence, estimated financial impact, accept/reject controls (per platform AI-guardrail rules: AI proposes, a human decides, every acceptance/rejection is logged).
7. Drill-down: every number on this page is clickable, descending group → cluster → pool → vehicle, landing in the relevant scoped view (B3/B5) rather than a separate "executive-only" detail page.

**Design constraint (explicit):** light, professional, same component language as the rest of the platform — this replaces the earlier "cinematic aurora" dark executive dashboard concept entirely.

---

## PART G — HR

### G1. Escalations & Disciplinary Queue

```
Route            /escalations
Actor(s)         HR
Purpose          Review fines-threshold and behaviour-score escalations, with the underlying evidence, before any formal action.
```

**Layout:** queue of escalation cases (driver, trigger reason, date raised) + a detail panel showing the underlying signal data (the fines list, or the behaviour-score contributing events) exactly as the driver themselves would see their own score — transparency is a stated design principle here, not just a courtesy. Decision controls: acknowledge / escalate further / close with note.

**Use cases:** a driver disputes a contributing fine that's still pending resolution → this is visibly flagged in the evidence so HR doesn't act on disputed data as if it were settled.

---

## PART H — DATA STEWARD

### H1. Data Quality & Migration Console

```
Route            /data-quality
Actor(s)         Data Steward
Purpose          Resolve migration batch exceptions and monitor ongoing inventory completeness.
```

**Layout:** batch history list (loaded/rejected/pending counts per batch) → selecting a batch shows row-level rejects with reasons, each resolvable inline (fix and re-validate, or mark for manual follow-up) → a standing completeness dashboard (per-field, per-pool) showing the current gap against the 98% target as a plain progress bar with the actual missing-field list underneath, not just a percentage.

**Use cases:** a suspected duplicate vehicle → a compare-and-merge view showing both records' fields side by side before committing a merge (destructive action, must be deliberate).

---

## PART I — SYSTEM ADMIN

### I1. Policy Engine — Decision Table Studio

```
Route            /admin/policies
Actor(s)         System Admin (author), with a required second-approver step for high-impact rule types
Purpose          Author, review and activate the decision tables that drive every automated decision in the platform — genuinely no-code.
```

**Layout regions:** rule-type list (booking buffer, eligibility, compliance ladders, etc.) → selecting one opens the **decision table editor**: a literal editable table (condition columns, outcome column), with a mandatory default row always pinned at the bottom and visually distinct (it can't be deleted, only edited). A "Test this rule" panel lets the admin enter sample inputs and see the row that would match, live, before publishing — this is the Policy Decision Trace pattern (§7.4) used in reverse, as an authoring aid.

**Key features:** every table shows its current version, effective date, and history (previous versions, diffable); publishing a high-impact rule type requires a second admin's sign-off, shown as an explicit approval step in this screen, not a silent save.

**Use cases:** admin edits a rule that would change the outcome for currently in-flight requests → a warning states this plainly before publishing ("this change will not apply retroactively; N pending requests were evaluated under the previous version").

---

### I2. Organization & Hierarchy Configuration

```
Route            /admin/organization
Actor(s)         System Admin
Purpose          Configure the cluster/pool/location hierarchy, labels, and branding — the reusability seam made visible.
```

**Layout:** a tree editor for the hierarchy (add/rename/move nodes, with historical integrity preserved — renaming a node never breaks past reports) + a simple form for terminology overrides (e.g. relabel "Cluster" to "Region") and branding (logo, accent colour within the platform's token system) + integration connection status (HR system, identity provider, telematics source) shown as plain status rows, not a diagram.

**Use case:** renaming or restructuring a node mid-year → historical reports still attribute past records to the hierarchy as it existed at the time (per platform audit rules), and this screen makes that guarantee explicit in the UI copy when a structural change is made.

---

## Appendix — Template for Adding a New Page

When a new screen is needed that isn't listed above, add an entry here using the exact template from §0 before building it. Do not build a screen without an entry existing first — this keeps the specification and the built product from drifting apart.
