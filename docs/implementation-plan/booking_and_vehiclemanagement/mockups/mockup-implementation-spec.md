# Mockup Implementation Spec — Vendor, Vehicle Management & Handover

> **Purpose.** This document lets an AI agent (or engineer) rebuild each supplied mockup screen
> pixel- and behaviour-faithfully without seeing the images. Every screen entry lists the exact
> route/context, layout regions, field-by-field content, component mapping, and interaction/validation
> rules observed in the mockup. Do not invent fields; if something is not listed here it was not shown.
>
> **Source set:** 29 PNG files representing 28 unique content screens: `01`-`26`, two captures of the Handover-mode walkaround (`27`-`28`), and `vehicle-overview-tab.png`.
> **Status:** Approved for phased implementation on 2026-07-21. Build page content inside the existing application shell; do not implement mockup shell chrome or the demo role switcher.

---

## 1. Mockup framing versus production shell

The screenshots contain two prototype frames, but neither authorizes shell work. The production application keeps its existing shell, navigation, authenticated role handling and global controls unchanged. Use the table only to identify which content screens came from each prototype source.

| Skin | Files | Product label | Shell colour | Sidebar accent | Use for |
| --- | --- | --- | --- | --- | --- |
| **Helm** (light) | `01`–`26` | "Helm · Fleet Platform" | Cream/off-white canvas (`#F5F2EC`-ish), white cards | Dark teal/navy active pill, olive/gold tab underline | Vendor admin, Vehicle management, Employee + Fleet Ops booking, handover register (desktop web) |
| **Wayfinder** (dark rail) | `27` | "Wayfinder · Fleet Platform" | Same cream canvas, **dark forest-green** left rail | Amber/gold active row | Handover & return walkaround (operational kiosk/tablet) |

Both share: top utility bar (search %, Comment, Tweaks, Edit, Present, Share — these are *prototype-tool chrome*, **not** app UI and must be omitted in implementation), an in-app top bar with role/segment switcher and an "Ask … AI" button, a persistent left nav, a bottom "View driver mobile app" affordance, and a signed-in user chip at bottom-left.

---

## 2. Global design tokens — align to the implemented **Wayfinder** design system

> **Critical correction (verified against `app-ui/src/index.css` + `app-ui/developer-docs/design-system.md`).**
> The two prototype frames (cream "Helm" / dark-green "Wayfinder") are *mockup themes only*. The codebase ships
> **one** design system — **Wayfinder** — with a light and a dark theme. Build to these real tokens, **not** the
> mockup's teal/olive/monospace reading. Do not introduce a second "Helm" theme, teal brand, olive underline, or a
> monospace font — none exist in the implementation.

| Token | Implemented value (Wayfinder) | Mockup reading it supersedes |
| --- | --- | --- |
| App canvas (`--paper`) | Warm cream `#f5f3ec` (light) / navy `#0b3d5c` (dark) | "cream `#F4F1EA`" ✓ close |
| Card surface (`--surface`) | `#ffffff` (light) / `#0e4a6b` (dark); radius token `--radius` = **3px** (`rounded-md`) | "~12px radius" ✗ (use 3px) |
| Brand / rail (`--brand`, `--rail`) | Deep **navy `#0b3d5c`** (`--brand-strong` `#0a3350`) | "dark teal `#0F3D3E`" ✗ (navy, not teal) |
| Signal / attention (`--signal`) | **Gold `#e2a33d`** (`--signal-strong` `#c6892a`) — attention/active only | "olive/gold `#9A8348`" ✗ (gold `#e2a33d`) |
| Primary action (`--action`) | Navy `#0b3d5c` on light; **gold `#e2a33d`** on dark; text `--action-ink` | "navy/teal" ✓ (navy) |
| AI accent (`--plum`) | `#5c4a73` (plum) — the "Ask AI" affordance | n/a |
| Status success (`--ok`) | Green `#1f7a4d` | ✓ |
| Status warning (`--warn`) | Orange `#c1791f` | ✓ |
| Status danger (`--danger`) | Red `#b33f3f` | ✓ |
| Status info (`--info`) | Teal `#0e5c7a` | n/a |
| Focus ring (`--ring`) | Navy `#0b3d5c` | n/a |
| Typography | **ONE family: IBM Plex Sans / IBM Plex Sans Arabic.** Data/IDs/plates/amounts use the same sans with `font-variant-numeric: tabular-nums` via the `.font-data` utility. | "monospaced for IDs" ✗ (**no mono face** — use `.font-data`) |
| Eyebrow / column headers | `.eyebrow` utility: 10.5–12px, UPPERCASE, `font-semibold`, letter-spacing | ✓ |
| Status pattern | **Status is never colour alone** — use `StatusChip` (square dot + UPPERCASE label) or `Badge` (`success`/`warning`/`destructive`/`secondary`/`outline`). Colour + icon + label always. | ✓ reinforce |
| Numbers/dates | `.font-data` (tabular-nums); currency `AED 1,234`; dates `02 Nov 2026` | replace "monospace" wording |
| Language / RTL | EN + **AR**; RTL is first-class — locale-first routes `/:lang/…`, `<html dir="rtl">` for `ar`, logical `start`/`end` properties. All copy via i18n keys (single `translation` namespace). | ✓ |

**Segment/role switcher:** demo-only context. Do not implement it. The authenticated principal and existing RBAC-derived navigation determine available pages and actions.

---

## 3. Navigation model

### 3.1 Helm — "Employee" nav (segment = Employee)
Header eyebrow: `GS POOL · MINA ZAYED` (the employee's home pool) / title varies by page (`Book a vehicle`, `Dedicated vehicle request`). Left nav:
`Home` · **`Book a vehicle`** · `Dedicated vehicle`. Top bar keeps the segment switcher, `Ask Helm AI`, notifications, dark-mode toggle, user avatar.

### 3.2 Helm — "Fleet Manager" nav (segment = Fleet Mgr)
Header eyebrow: `GROUP OPERATIONS` / title `Vehicle management`. Left nav items (icon + label), active = filled pill:
`Ops dashboard` · `Handover & return` · `Create booking` · `Booking approvals` · **`Vehicle management`** · `Compliance & alerts` · `Fines & black points` · `Live map`.

### 3.3 Helm — "Administrator" nav (segment = Admin)
Header eyebrow: `PLATFORM ADMINISTRATION` / title `Vendors & lease contracts`. Left nav:
`Admin console` · `Policies & rules` · `Users & access` · `Organization` · **`Vendors & leases`** · `Lookup management` · `System & integrations`.

### 3.4 Wayfinder — "Operations" nav
Eyebrow `OPERATIONAL` / title `Handover & return`. Left nav:
`Booking & consent` · **`Handover & return`** · `Approval inbox` · `Entitlement decision` · `Command console` · `Fines & black points` · `Executive dashboard`. Top bar has a **pool/location selector** (`Pool · Khalifa Port Pool ▾`), `Ask AI`, notifications, dark-mode toggle, **`العربية`**, user avatar.

---

## 4. Screen catalogue

Files are ordered `01`→`27`. Reading order below matches filenames.

Legend for each entry: **Route/context · Purpose · Layout · Fields/content · Components · States/rules.**

---

### VENDOR & LEASE (Admin segment)

#### `01-vendor-master-list.png` — Vendors & lease contracts › **Vendor master** tab
- **Context:** Admin segment. Eyebrow `C13 · SYNCED WITH PROCUREMENT (ORACLE FUSION · I3)`. Page title **Vendors & lease contracts**. Top-right primary button **`+ Onboard vendor`**.
- **Tabs:** `Vendor master` (active) · `Lease contracts` · `Off-hire & discrepancies`.
- **Layout:** Two-column — left = vendor table (~65%), right = selected-vendor detail card.
- **Table columns:** `VENDOR` (name + sub-line `VEN-#### · since YYYY`), `CATEGORY`, `VEHICLES`, `SPEND / MO`, `SCORE` (letter grade).
  - Rows: AutoLease Gulf · VEN-0102 · since 2021 · Lessor · 412 · AED 1.02M · **B+** (selected/highlighted); Emirates Motors Services · VEN-0088 · 2019 · Repair & maintenance · 640 · AED 310K · A−; Gulf Fleet Leasing · VEN-0145 · 2023 · Lessor · 186 · AED 428K · C; TrackSense ME · VEN-0201 · 2024 · Telematics · 1180 · AED 64K · B; ADNOC Distribution · VEN-0011 · 2018 · Fuel supplier · 1240 · AED 890K · A.
- **Detail card (right):** Header `AutoLease Gulf` + grade `B+`; sub `Lessor · VEN-0102 · procurement-linked`.
  - Section **`SCORECARD — COMPUTED FROM PLATFORM DATA, NOT SELF-REPORTED`**: `Repair turnaround vs SLA 2.3d / 3.0d`; `Off-road days per vehicle (12m) 4.1`; `Repeat failures (90d) 3`; `SLA breaches (12m) 2`; `Cost vs market benchmark −4%`.
  - Section **`ACTIVE CONTRACTS`**: `LC-2023-0441 · 96 vehicles · Ports · ACTIVE`; `LC-2024-0128 · 210 vehicles · group · ACTIVE`; `LC-2021-0033 · 106 vehicles · Logistics · ENDS 74D` (amber).
- **Components:** Tabs, DataTable (selectable rows), detail Card, KPI rows, status Badges, primary Button.
- **Rules:** Scorecard is *system-computed* (emphasise the label). Selecting a table row updates the right card.

#### `02-vendor-lease-contracts.png` — Vendors & lease contracts › **Lease contracts** tab
- **Layout:** 4 KPI stat cards on top, full-width contracts table below, footnote under table.
- **KPI cards:** `ACTIVE CONTRACTS 9` (`4 vendors`); `LEASED VEHICLES 812` (`of 1,240`); `MONTHLY LEASE SPEND 2.14M` (`AED`); `EXPIRING ≤ 90 DAYS 3` (`223 vehicles`).
- **Table columns:** `CONTRACT` · `VENDOR` · `VEHICLES` · `MONTHLY (AED)` · `ENDS` · `RENEWAL LADDER` · `OFF-HIRE / PENALTY`.
  - LC-2021-0033 · AutoLease Gulf · 106 · 242,000 · 30 Sep 26 · `74d · 90-DAY` (amber) · 30-day notice · AED 4,500/veh early-term.
  - LC-2023-0290 · Gulf Fleet Leasing · 186 · 396,000 · **28 Aug 26** (red) · `41d · 60-DAY` (amber) · 60-day notice · 2 mo penalty.
  - LC-2023-0441 · AutoLease Gulf · 96 · 302,000 · 30 Sep 27 · `ON TRACK` (green) · 30-day notice · AED 4,500/veh.
  - LC-2024-0128 · AutoLease Gulf · 210 · 648,000 · 31 Mar 28 · `ON TRACK` (green) · 90-day notice · sliding scale.
  - LC-2025-0067 · Gulf Fleet Leasing · 31 · 87,000 · 31 May 26 · `—` · Expired — renewed as LC-2026-0021.
- **Footnote:** "Expiry alerts go to Procurement and the scoped fleet manager at 90 / 60 / 30 days (ladder configurable per tenant). Target: 100% of expiries actioned before end date — no silent renewals."
- **Rules:** Contract ref is a link (monospace). Colour ENDS date red when inside penalty window; renewal-ladder chip shows days-remaining + ladder type.

#### `03-vendor-offhire-discrepancies.png` — Vendors & lease contracts › **Off-hire & discrepancies** tab
- **Layout:** Two columns. Left = **`OFF-HIRE WORKFLOWS IN PROGRESS`** (stacked workflow cards). Right = **`CONTRACT-VS-INVOICE DISCREPANCIES → FINANCE + PROCUREMENT`** (stacked discrepancy cards).
- **Off-hire card shape:** vehicle title (e.g. `Toyota Hiace · AD 61220`) + contract ref chip (`LC-2021-0033`) + amber status pill `OFF-HIRE PENDING`; a one-line AI rationale (e.g. "AI right-sizing — utilisation 22% for 6 months · net case +AED 38,400 over remaining term"); a **5-step progress tracker**: `Initiated` → `Condition report` → `Penalty computed` → `Vendor ack.` → `Returned` (completed steps green, current step amber-underlined).
  - Card 2: `Nissan Urvan · AD 48810` · LC-2023-0290 · "Repeat failures — 4 breakdowns in 90 days · net case +AED 21,050 net of penalty".
- **Discrepancy card shape:** ref + label (e.g. `LC-2023-0290 · June invoice`) + right-aligned amount `+AED 10,650`; explanation line.
  - `LC-2024-0128 · June invoice` `+AED 13,440` — "Rate applied AED 3,150/veh vs contracted 3,086 — escalation clause misapplied."
  - `SVC-2024-0071 · work order 8841` `+AED 940` — "Brake job billed outside lease-inclusive scope — pending vendor credit note."
- **Footnote (left):** "Sequence: initiation → condition report → penalty computation → vendor acknowledgement → returned. The vehicle sits in **Off-Hire Pending** until the lessor confirms collection."
- **Components:** Stepper/progress tracker, Card list, currency Badge.

#### Onboard vendor wizard (Admin) — 5 steps, left step-rail + right form + sticky footer

Shared chrome for `04`–`08`: back link `← Vendors & leases`; left rail card titled **`ONBOARD VENDOR`** with numbered steps `1 Source & identity · 2 Compliance documents · 3 Terms & SLA · 4 Integration & access · 5 Review & submit` (done = green check, current = filled navy circle, pending = grey circle). Rail footnote: **"Segregation of duties: admins configure the vendor record — Procurement approves before any contract can reference it."** Footer: `Back` (secondary) + `Continue →` (primary, full-width from step 2 on).

#### `04-vendor-onboard-step1-source-identity.png` — Step 1 · Source & identity
- **Heading:** "Where does this vendor come from?" + helper "Procurement-linked vendors sync commercial data from Oracle Fusion (I3); manual records need full entry and carry a data-quality flag until verified."
- **Choice cards (2, selectable):** **`Import from Procurement (I3)`** (selected — "Lookup by Fusion supplier ID — name, TRN, bank and payment terms sync automatically.") · **`Create manually`** ("For vendors not yet in Fusion — flagged for steward verification, blocked from payment runs.").
- **Lookup row:** text input placeholder `Fusion supplier ID — e.g. SUP-104482` + **`Look up`** button.
- **`VENDOR CATEGORY — DRIVES REQUIRED TERMS & SCORECARD MODEL`** segmented toggle: `Lessor` (selected) · `Repair & maintenance` · `Telematics` · `Fuel supplier` · `Other`.
- **Fields (2×2 grid):** `LEGAL NAME` (Al Wathba Vehicle Leasing LLC) · `TRADE LICENCE NO. + EMIRATE` (CN-1044829 · Abu Dhabi) · `TRN (TAX REGISTRATION)` (100482977300003) · `PRIMARY CONTACT` (placeholder `name · role · email · phone`).
- **Footer:** `Continue →` (full-width).
- **Rules:** Category selection changes downstream required docs & scorecard model. Manual create sets a data-quality flag and blocks payment runs.

#### `05-vendor-onboard-step2-compliance-documents.png` — Step 2 · Compliance & commercial documents
- **Heading + helper:** "Versioned in the vault; expiry alerts follow the standard ladder. A vendor with an expired trade licence or insurance is suspended from new contracts automatically."
- **Document rows** (each: title + REQUIRED/OPTIONAL tag + helper + right-side `Missing` amber label + `Upload scan` button):
  - `Trade licence` **REQUIRED** — "Expiry tracked — expired licence suspends the vendor from new contracts".
  - `Liability insurance certificate` **REQUIRED** — "Minimum cover per group policy · OCR reads insurer, cover, expiry".
  - `Master service agreement` **REQUIRED** — "Signed MSA — contracts reference this document".
  - `Signatory authorisation` **OPTIONAL** — "Power of attorney for the signing officer".
- **Fields:** `PAYMENT TERMS` (Net 45 · AED) · `BANK IBAN` (masked `AE** **** **** **** ***` — helper "masked — Finance only").
- **Footer:** `Back` + `Continue →`.
- **Rules:** OCR auto-extracts insurer/cover/expiry. IBAN masked; visible to Finance role only.

#### `06-vendor-onboard-step3-terms-sla.png` — Step 3 · Lease terms & penalties
- **Heading + helper:** "Captured at onboarding so AI lease-reduction recommendations can compute the true financial case (FR-VEN-07)."
- **Fields (2-col):** `DEFAULT CURRENCY` (AED) · `STANDARD OFF-HIRE NOTICE` (30 days) · `EARLY-TERMINATION PENALTY` (AED 4,500/vehicle or sliding scale) · `RENEWAL OPTIONS` (2 × 12-month extensions) · `ESCALATION CLAUSE` (CPI-linked · max 3% p.a.) · `REPLACEMENT CLAUSE` (Like-for-like within 48h).
- **`EXPIRY / RENEWAL ALERT LADDER`** segmented toggle: `90/60/30 days` (selected) · `120/90/60/30 days` · `60/30/7 days`.
- **Footnote:** "Alerts go to Procurement and every fleet manager whose node has vehicles on the contract."
- **Footer:** `Back` + `Continue →`.

#### `07-vendor-onboard-step4-integration-access.png` — Step 4 · Integration & access
- **Heading + helper:** "How invoices, telemetry and users connect for this vendor."
- **Integration rows** (title + helper + right status badge):
  - Prototype evidence shows `Procurement sync (I3)` as `LINKED`, `Finance AP invoice feed (I2)` as `AUTO`, Document OCR as `ON APPROVAL`, and Vendor portal as `Enabled`.
  - **Approved implementation override:** until a real adapter/environment gate passes, render each as disabled `Future integration` with its dependency. Manual entry/upload/review remains available; never display fixture synchronization as live.
- **Footer:** `Back` + `Continue →` (shown focused/pressed).

#### `08-vendor-onboard-step5-review-submit.png` — Step 5 · Review & submit to Procurement
- **Heading + helper:** "The record activates when Procurement approves — admins cannot self-approve vendors (SoD)."
- **Summary rows** (icon + label + right value; green check or amber warning icon):
  - ✓ `Source` → Procurement-linked · SUP-104482.
  - ✓ `Category` → Lessor — scorecard model set.
  - ⚠ `Compliance documents` → 0 of 4 uploaded (3 required).
  - ✓ `Terms & SLA` → Lease terms & penalties captured.
  - ✓ `Alert ladder` → 90/60/30 days.
  - ✓ `Vendor portal` → Enabled — contract-scoped.
- **Action row:** helper "Missing required documents — submission allowed, activation blocked until complete." + **`Submit for approval →`** primary button.
- **Rules:** Submit allowed with missing docs, but **activation blocked** until complete; approval is Procurement's (SoD).

---

### VEHICLE MANAGEMENT (Fleet Mgr segment)

#### `09-vehicle-list-all-vehicles.png` — Vehicle management › **All vehicles** list (module home)
- **Context:** Fleet Mgr segment. Eyebrow `FLEET MASTER · GS POOL — MINA ZAYED + SCOPED NODES`. Page title **Vehicle management**. Top-right buttons: **`Import / migrate`** (secondary) + **`+ Onboard vehicle`** (primary).
- **KPI stat cards (5):** `TOTAL VEHICLES 223` (`in scope`) · `AVAILABLE NOW 141` (`63%`, green) · `IN USE 58` (`26%`) · `UNDER MAINTENANCE 17` (`+4 predicted`, amber) · `COMPLIANCE BLOCKS 3` (`hard-blocked`, red).
- **Table columns:** `VEHICLE` (make/model + sub-line `plate · km`) · `HIERARCHY NODE` · `LIFECYCLE` (badge) · `OPERATIONAL` · `GPS` · `MULKIYA` (expiry date) · `INSURANCE` (expiry date) · trailing **`GPS`** button.
  - Toyota Land Cruiser · AD 40213 · 61,204 km · GS Pool — Mina Zayed · `Active` · Active · ● Live · 02 Nov 2026 · 05 Aug 2026.
  - Nissan Patrol · AD 88914 · 48,213 km · GS Pool — Mina Zayed · `In Use` · Standby · ● Live · 15 Jan 2027 · 01 Dec 2026.
  - Toyota Hiace · AD 55102 · 102,880 km · GS Pool — Mina Zayed · `Under Maintenance` · Temporary Hold · Offline · 20 Sep 2026 · 10 Feb 2027.
  - Toyota Fortuner · — (pre-allocation) · 0 km · Kezad HQ · `Reserve` · Active · None · — · —.
  - Toyota Corolla · AD 77128 · 73,410 km · Khalifa Port Pool · `Active` · Active · ● Live · 11 Mar 2027 · 22 Jun 2027.
  - Nissan Patrol · AD 51002 · 92,084 km · Zayed Port Pool · `Active` · Active · ● Live · 30 Apr 2027 · 14 Jul 2026.
  - Nissan Patrol · AD 33198 · 39,220 km · Logistics — Dedicated · `Dedicated` · Active · ● Live · 19 May 2027 · 02 Sep 2026.
  - Kia EV6 · AD 90044 · 11,004 km · GS Pool — Mina Zayed · `Active` · Active · ● Live · 08 Jan 2028 · 08 Jan 2027.
  - Toyota Hiace · AD 24410 · 58,900 km · Zayed Port Pool · `Active` · Active · ● Live · 01 Oct 2026 · **17 Jul 2026** (red — near/at expiry).
- **Badge palette:** `Active` peach/amber, `In Use` grey, `Under Maintenance` amber, `Reserve` blue, `Dedicated` blue. `GPS` column: `● Live` (green) / `Offline` (grey) / `None` (pre-allocation). Expiry dates turn red inside the alert window.
- **Components:** KPI StatCard row, DataTable with badges + inline action button, header action buttons.
- **Rules:** Row → vehicle quick-view drawer (`15`) / full detail (`16`–`20`). `+ Onboard vehicle` → wizard (`10`–`14`). `Import / migrate` → bulk import wizard (see L9). List is scoped to the signed-in manager's nodes (eyebrow shows scope).

#### Onboard vehicle wizard — 5 steps, left step-rail + right form + sticky footer

Shared chrome for `10`–`14`: back link `← Vehicle management`; left rail card **`ONBOARD VEHICLE`** with steps `1 Acquisition scenario · 2 Identity & classification · 3 Hierarchy & operational · 4 Compliance & telematics · 5 Review & activate`. Rail footnote: **"Onboarding many vehicles? Use Import / migrate — bulk CSV with validation, dedup and steward sign-off."** Footer: `Back` + `Continue →`.

#### `10-vehicle-onboard-step1-acquisition-scenario.png` — Step 1 · Acquisition scenario
- **Heading + helper:** "How is this vehicle entering the fleet?" + "The scenario decides which commercial records are mandatory before activation."
- **Choice cards (2×2, selectable):** **`Leased`** (selected — "Vendor lease — contract, monthly cost, off-hire terms mandatory.") · `Owned — new purchase` ("Bought outright — PO reference and book value mandatory.") · `Transfer-in` ("Moving from another node — record and history carry over.") · `Lease replacement` ("Swap for an off-hired vehicle on the same contract.").
- **`REQUIRED FOR THIS SCENARIO` panel (bullets, changes per selected card):** "Lease contract (vendor, ref, start/end, monthly cost, off-hire terms)"; "Vendor must exist in vendor master — or create first"; "Renewal alert ladder auto-set to 90/60/30 days".
- **Fields (2×2, shown for the Leased scenario):** `VENDOR` (AutoLease Gulf) · `LEASE CONTRACT REF` (LC-2026-••••) · `MONTHLY COST (AED)` (3,150) · `LEASE START → END` (01 Aug 2026 → 31 Jul 2029).
- **Footer:** `Continue →` (full-width primary).
- **Rules:** Scenario selection drives which downstream records/fields are mandatory. Leased requires a vendor that already exists in vendor master (else create it first). Owned requires PO reference + book value; Transfer-in carries record/history; Lease replacement links to the off-hired vehicle's contract.

#### `11-vehicle-onboard-step2-identity-classification.png` — Step 2 · Identity & classification
- **Heading + helper:** "Every field mandatory at onboarding unless marked optional (P5.1)."
- **VIN row:** input placeholder `VIN / chassis number` + **`Decode VIN`** button (dark).
- **Fields (3-col grid):** `PLATE (EMIRATE + CODE)` (AD 61••••) · `MAKE / MODEL` (Toyota Fortuner) · `YEAR` (2026) · `VEHICLE CLASS` (SUV — Class C) · `SEATS / FUEL` (7 · Petrol) · `EFFICIENCY (KM/L)` (8.9 — helper "drives expected-fuel calc").
- **Footer:** `Back` + `Continue →`.
- **Rules:** Decode VIN auto-fills classification. Efficiency feeds fuel projections.

#### `12-vehicle-onboard-step3-hierarchy-operational.png` — Step 3 · Hierarchy & operational state
- **Heading + helper:** "Exactly one node per mandatory level. Location is optional at this tenant."
- **Fields:** `CLUSTER · MANDATORY` (Ports) · `POOL · MANDATORY` (GS Pool — Mina Zayed) · `LOCATION · OPTIONAL` (placeholder Yard A).
- **`OPERATIONAL STATUS AT ENTRY`** segmented toggle: `Active` (selected) · `Reserve` · `Standby` · `VIP Only` · `Quarantined`.
- **Include-in-pool card:** "Include in booking pool immediately?" + helper "Only possible once compliance documents are valid — checked at activation." + toggle **`Include ✓`** (green).
- **Footer:** `Back` + `Continue →`.

#### `13-vehicle-onboard-step4-compliance-telematics.png` — Step 4 · Compliance & telematics
- **Card A — Compliance documents:** helper "Upload scans — OCR extracts numbers and expiry dates; you confirm. Booking stays blocked until mulkiya and insurance are valid."
  - `Mulkiya (registration)` **REQUIRED** — "OCR reads plate, VIN and expiry — mismatch vs entered VIN blocks activation." · `Missing` · `Upload scan`.
  - `Insurance policy` **REQUIRED** — "Must be valid on activation date — expired insurance = hard block." · `Missing` · `Upload scan`.
  - `Periodic inspection certificate` **IF > 3 YEARS OLD** — "Required for vehicles older than 3 years in reference jurisdiction." · `Missing` · `Upload scan`.
- **Card B — Telematics & on-vehicle assets:** segmented toggle `Install telematics unit` (selected) · `Unit already fitted` · `No telematics — manual odometer`.
  - Fields: `FUEL CARD` (FC-70021-•• · ADNOC) · `SALIK TAG` (SLK-•••••••) · `DARB TAG` (DRB-•••••••).
- **Footer:** `Back` + `Continue →`.
- **Rules:** VIN mismatch on mulkiya OCR blocks activation; expired insurance is a hard block.

#### `14-vehicle-onboard-step5-review-activate.png` — Step 5 · Review & activate
- **Heading + helper:** "Steward sign-off makes the record operational; it enters the pool only if compliance passes."
- **Completeness bar:** `Record completeness` `37 / 61 mandatory fields` with a partial progress bar (amber/olive fill).
- **Summary rows** (check / warning icon + label + right value):
  - ✓ `Acquisition` → Leased.
  - ⚠ `Identity & classification` → VIN not verified.
  - ✓ `Hierarchy` → Ports › GS Pool — Mina Zayed.
  - ✓ `Operational status` → Active · booking pool: included.
  - ⚠ `Compliance documents` → 0 of 3 uploaded.
  - ✓ `Telematics` → GPS unit · 30s feed.
- **Action row:** helper "Missing documents — record is created but stays blocked from booking." + **`Activate vehicle →`** primary button.

#### `15-vehicle-quickview-overview-drawer.png` — Vehicle quick-view (Overview drawer)
- **Context:** Right-side **slide-over drawer** (~30% width) launched by clicking a row in the `09` All vehicles list (list dims behind). Acts as the compact **Overview** for a vehicle.
- **Header:** title **`Toyota Land Cruiser`** + `AD 40213`; close **`×`** button.
- **`LIVE LOCATION`** section: green `● GPS LIVE` label; embedded OpenStreetMap mini-map with green location pin + zoom `+/−`; caption `Mina Zayed — Yard B` · `ping 30 sec ago`.
- **Metric grid (2×2):** `SPEED 0 km/h` · `HEADING Parked` · `IGNITION Off` · `DRIVER Unassigned · at yard`.
- **Geofence banner (green):** `Inside Mina Zayed geofence`.
- **`IDENTITY` (2-col):** `POOL GS Pool — Mina Zayed` · `YARD Yard B` · `SEATS 7` · `FUEL Hybrid` · `ODOMETER 61,204 km` · `TELEMATICS Online`.
- **`COMPLIANCE DOCUMENTS`:** `Mulkiya (registration) 02 Nov 2026` · `Insurance 05 Aug 2026`.
- **`RISK & HISTORY`:** `Lifetime fines 1`.
- **Components:** Slide-over/Drawer, mini-map, metric grid, definition lists, status banner.
- **Rules:** Read-only quick glance; deep-links to the full tabbed record (`16`–`20`). Substantially covers the Overview need, but the **full-page `Overview` tab** is still not shown as its own screen.

#### Vehicle detail — tabbed record (Fleet Mgr)

Shared chrome for `16`–`20`: back link `← All vehicles` (→ the `09` All vehicles list). **Identity header card:** vehicle icon + title **`Toyota Land Cruiser`** + two status pills (`Active` amber-ish, `Active` grey); sub-line `AD 40213 · VIN JTMHV05J•••••••• · GS Pool — Mina Zayed · 61,204 km`; right side eyebrow `BOOKING POOL` + green **`Included ✓`** pill. **Tab bar:** `Overview` · `Ownership & lease` · `Compliance & documents` · `Telematics & GPS` · `Maintenance` · `Lifecycle history` (active tab olive underline).

> **NOTE:** `vehicle-overview-tab.png` supplies the full-page Overview content. Implement it alongside, not instead of, quick-view drawer `15`.

#### `16-vehicle-detail-ownership-lease.png` — Ownership & lease tab
- **Layout:** left card `LEASE CONTRACT`; right column has `LIFETIME COST (MASKED PER ROLE MATRIX)` card + `VENDOR SCORECARD` card.
- **`LEASE CONTRACT` (2-col facts):** `OWNERSHIP` Leased · `VENDOR` AutoLease Gulf · `CONTRACT REF` LC-2022-0198 · `MONTHLY COST` AED 2,400 · `START` 01 Jan 2023 · `END` 31 Dec 2026 · `OFF-HIRE TERMS` 30-day notice · `RENEWAL OPTIONS` 1 × 12-month option. Amber inline banner: "Lease renews in 74 days — alert ladder 90/60/30 active; Procurement notified at 90."
- **`LIFETIME COST` card:** `Lease (36 mo)` AED 113,400 · `Fuel lifetime` AED 21,880 · `Maintenance lifetime` AED 9,140 · `Tolls (Salik + Darb)` AED 3,412 · `Fines recovered` AED 1,120 · **`Total cost of ownership / month` AED 4,310** (bold).
- **`VENDOR SCORECARD — AUTOLEASE GULF` card:** grade `B+`; `Repair turnaround vs SLA` 2.6 days / 3.0d · `Off-road days (12m)` 3 days · `Repeat failures` 1 · `Invoice discrepancies` 2 open; full-width link button **`Start off-hire workflow →`**.
- **Rules:** Lifetime cost visibility is role-masked. Renewal banner tied to alert ladder.

#### `17-vehicle-detail-compliance-documents.png` — Compliance & documents tab
- **Table columns:** `DOCUMENT` · `REFERENCE` · `ISSUED` · `EXPIRES` · `STATUS` · `VAULT`.
  - Mulkiya (registration) · REG-AD40213 · 02 Nov 2025 · 02 Nov 2026 · `Valid` · `v3 · view`.
  - Insurance policy · POL-88231-AXA · 01 Dec 2025 · 05 Aug 2026 · `Valid` · `v2 · view`.
  - Periodic inspection · INS-2026-0331 · 28 Feb 2026 · 28 Feb 2027 · `Valid` · `v1 · view`.
  - ADNOC fuel card · FC-70021-V1 · 01 Jan 2026 · 31 Dec 2026 · `Active` · `v4 · view`.
  - Salik tag · SLK-3390812 · — · n/a · `Active` · `v1 · view`.
  - Darb tag · DRB-1104420 · — · n/a · `Active` · `v1 · view`.
- **Hard-block banner (light red, ⓘ):** "**Hard-block rule.** An expired mulkiya or insurance disables booking group-wide for this vehicle with no override. Alerts escalate 30 → 14 → 7 → 1 days before expiry to the fleet manager, then the cluster data steward."
- **Components:** DataTable, status Badges, versioned document "view" links.

#### `18-vehicle-detail-telematics-gps.png` — Telematics & GPS tab
- **Layout:** left map panel (OpenStreetMap-style with vehicle pin, zoom +/− controls) with a 4-metric strip beneath; right `DEVICE` card + geofence banner.
- **Map footer strip:** `SPEED` 0 km/h · `HEADING` Parked · `IGNITION` Off · `LAST PING` 30 sec ago.
- **`DEVICE` card:** `GPS status` **Online** · `Device IMEI` 86412303••••212 · `Installed` 12 Oct 2023 · `Odometer source` Telematics (auto) · `Data feed` CAN bus + GPS · 30s interval.
- **Geofence banner (green, shield icon):** "Inside Mina Zayed geofence".
- **Components:** Map, KPI strip, definition-list Card, status banner. (Map tiles are illustrative — use the project's map provider.)

#### `19-vehicle-detail-maintenance.png` — Maintenance tab
- **Top 3 stat cards:** `NEXT SERVICE` per OEM schedule (`—`) · `OFF-ROAD DAYS (12M)` 3 (`pool median 6`) · `AVG REPAIR TURNAROUND` 2.6 days (`vendor SLA 3.0 days`).
- **Table columns:** `DATE` · `WORK` (title + sub-line) · `VENDOR` · `DOWNTIME` · `COST`.
  - 14 May 26 · 40,000 km scheduled service ("Oil, filters, brake inspection · workshop bay 2") · AutoLease Gulf · 1.5 days · AED 940.
  - 02 Feb 26 · Front brake pads ("Wear at 82% — replaced under lease") · AutoLease Gulf · 0.5 days · Lease-inclusive.
  - 18 Nov 25 · Tyre set ×4 ("Tread below 3mm — fleet standard") · Emirates Tyres · 0.5 days · AED 2,180.
  - 09 Aug 25 · Windscreen chip repair ("Logged at return BK-0871 — recovered from driver") · GlassFix AD · 0 days · AED 260.

#### `20-vehicle-detail-lifecycle-history.png` — Lifecycle history tab
- **Layout:** left `LIFECYCLE EVENTS — APPEND-ONLY AUDIT` timeline; right `RECORD AUDIT` card.
- **Timeline items (newest→oldest, dot + title + date + sub-line):**
  - `Transfer — Zayed Port Pool → GS Pool` · 02 Jul 2026 — "Demand rebalance · approved R. Haddad · from LOC-ZPA to LOC-GSA."
  - `Operational status → Standby` · 11 Apr 2026 — "Set by Fleet Ops — reserve coverage for VIP delegation week."
  - `Incident — windscreen chip` · 09 Aug 2025 (amber dot) — "Logged at return of BK-0871 · damage charge recovered via payroll consent."
  - `Entered booking pool` · 15 Oct 2023 — "Post-onboarding checks passed · telematics verified · GS Pool — Mina Zayed."
  - `Onboarded — leased from AutoLease Gulf` · 01 Oct 2023 — "Contract LC-2023-0441 · migration batch MB-114 · steward sign-off D. Suresh."
- **`RECORD AUDIT` card:** `Created by` Migration batch MB-114 · 01 Oct 2023 · `Data steward` D. Suresh · Ports cluster · `Last modified` Fleet Ops · 02 Jul 2026 · `Record completeness` **61 / 61 mandatory fields**.
- **Rules:** Append-only audit — no edit/delete of events.

---

### BOOKING (Employee self-service + Fleet Ops)

> **Booking redesign v2 (2026-07-24) — supersedes the layout of `21`–`25` below.** Six new employee
> mockups landed in this folder. They keep the same data/flow but adopt the registered **Page hero**
> (now with a **date/context line** — see design-system §8) and a set of signature patterns. Build the
> booking screens to these:
>
> | New mockup file | Screen | Key patterns (design-system §8) |
> | --- | --- | --- |
> | `bookig-screen-new.png` | Book a vehicle — **Search + results** | Hero + **Progress stepper** (Search→Choose→Consent→Confirmed) · navy **search card** (Return-to-yard / One-way toggle; From/To/Date/Pick-up/Return/Passengers-stepper; gold Search) · eligibility chips (Licence valid · No blocks · 1 of 3 bookings) · **Filters** rail (vehicle class counts, fuel chips) · **Sort tabs** (Recommended/Earliest/Nearest/Greenest) · **eligible-vehicle cards** (icon tile, name+plate, spec chips, availability chip, CO₂ + fuel/energy estimate, **Select** / **Join waitlist**, `RECOMMENDED` gold tag) |
> | `boking-screen-detail-after-select.png` | Book a vehicle — **Consent** | Hero + stepper (Consent active) · left = selected-vehicle card + **route timeline** (09:00→15:00) + date/passengers + **cost breakdown** card (electric estimate, tolls, carbon) · right = **Digital consent** card (checklist, "I have read and agree (policy v3.2)", type-to-sign name, disabled **Sign & confirm** until complete) |
> | `booking-confirmed.png` | Book a vehicle — **Confirmed** | Hero + stepper (Confirmed) · centered success check + **Booking pass** card (BK-#### + QR, route timeline, vehicle/destination/key/date grid) · **Book another** / **Back to home** |
> | `booking-screen-dedicted-new.png` | **Dedicated request** (form) | Hero · two-column: left form (Request type cards Ongoing/Temporary; Driver option cards Self-drive/With-driver; **Duration** chips 3/6/12/24/36 mo; Location; Cost centre; Business justification) · right = **indicative-monthly** navy card + **approval-route** info card + **Check eligibility →** |
> | `booking-scrren-dedicated-request.png` | **Dedicated eligibility + approval** | Hero · **Request eligibility + approval chain** pattern: left automated-eligibility checklist (grade eligible, no blocks, routes to Cluster CEO) · right vertical **approval chain** (You SUBMITTED → R. Haddad LINE MANAGER → Cluster Fleet Lead ENDORSE → Cluster CEO POLICY GATE) + **Confirm & send for approval** |
> | `employee-homoe-landing.png` | **Home** | Hero · greeting card ("Good morning, Amina.") + **stat tiles** (Upcoming trips / Outstanding fine / Licence valid) · red **alert banner** ("One fine needs your attention" + Start transfer) · **Your bookings** list (status chips Approved/Awaiting approval) · **Recommended for you** vehicle cards |
>
> **Registered global change:** the **Page hero date/context line** (calendar + full localized date) now
> appears on **every** page — implemented once in `components/ui/page-header.tsx` and inherited by all
> screens; mirrors under RTL. See design-system.md §8 "Page hero".

#### `21-booking-employee-book-a-vehicle.png` — Book a vehicle (Employee, self-service)
- **Context:** Employee segment. Eyebrow `GS POOL · MINA ZAYED`, title **Book a vehicle**. Heading **"Where to today?"** + helper "Pick a window and we'll match you with an eligible vehicle. Consent is signed before submission — no consent, no booking number."
- **Trip search bar (4 fields):** `Destination` (Khalifa Port, Gate 4) · `Pick-up` (09:00) · `Return` (15:00) · `Passengers` (2, dropdown).
- **`Today at GS Pool`** (`Thu 9 Jul · 06:00–18:00`) — **availability timeline (Gantt)**, one row per vehicle:
  - `AD 40213 · Land Cruiser · 7 seats` — `Booked` (grey) then `Book from 12:30 →` (green).
  - `AD 88914 · Patrol · 5 seats` — `Open` (green) / `Your booking · 09–15` (navy) / `Open` (green).
  - `AD 55102 · Hiace · 12 seats` — `Under maintenance` (grey) / `Book from 13:00 →` (green).
  - Legend: `Your booking` (navy) · `Booked / unavailable` (grey) · `Open` (green).
- **`Eligible vehicles`** (`4 matching your trip`) — cards (make/model + plate; seats · fuel · yard; availability chip; est. fuel; **`Book`** button):
  - Toyota Land Cruiser · AD 40213 · 7 seats · Hybrid · Yard B · `Available from 12:30` (amber) · Est. fuel 6.1L.
  - Nissan Patrol · AD 88914 · 5 seats · Petrol · Yard A · `Booked until 15:00` (grey) · Est. fuel 7.4L.
  - Toyota Hiace · AD 55102 · 12 seats · Diesel · Yard B · `Free from 13:00` (amber) · Est. fuel 9.8L.
  - Kia EV6 · AD 90044 · 5 seats · Electric · Yard A · `Available all day` (green) · Est. 9.1 kWh.
- **Components:** Trip search bar, availability Gantt timeline, vehicle cards with primary `Book` CTA.
- **Rules:** Consent signed before submission ("no consent, no booking number"). Booking `Book` → consent + confirmation (not supplied). EV shows kWh instead of litres.

#### `22-booking-employee-dedicated-vehicle-request.png` — Request a dedicated vehicle (Employee)
- **Context:** Employee segment. Eyebrow `GS POOL · MINA ZAYED`, title **Dedicated vehicle request**. Heading **"Request a dedicated vehicle"** + helper "Eligibility is evaluated automatically against your grade and role before this reaches your line manager. Requests above policy thresholds route to your Cluster CEO."
- **Form card:**
  - `Request type` segmented: **`Long-term`** (selected) · `Temporary`.
  - `Driver option` segmented: `With driver` · **`Without driver`** (selected).
  - `Duration (months)` (24) · `Location` (Kezad 280).
  - `Cost centre` (placeholder `e.g. LOG-4410`).
  - `Business justification` (textarea — placeholder "Explain the operational need — sites covered, rotation pattern, time saved…").
  - **`Check eligibility →`** full-width primary button.
- **Rules:** Auto-eligibility vs grade/role before line-manager routing; above-threshold requests escalate to Cluster CEO. (This is the D1 request entry; the D2 decision/allocation screen is not supplied.)

#### `23-booking-create-on-behalf.png` — Create booking · On behalf of an employee (Fleet Ops)
- **Context:** Fleet Mgr segment. Eyebrow `FR-BOOK-21 · BOOKINGS RAISED BY FLEET OPS ARE FLAGGED & AUDITED`, title **Create booking**.
- **Mode cards (2):** **`On behalf of an employee`** (selected — "Normal flow — routes to the employee's line manager for approval; the employee signs consent before collection.") · `Emergency — break-glass` `AUDITED` ("Immediate confirmation outside approval flow for defined emergency categories — flagged for post-hoc review.").
- **Driver card** (`DRIVER — ELIGIBILITY CHECKED BEFORE CONFIRMATION (FR-BOOK-12)`): input `Employee name or ID — e.g. EMP-20481` + **`Check eligibility`** button. Fields: `PICK-UP → RETURN WINDOW` (Today 13:00 → 17:00) · `DESTINATION` (Khalifa Port — Gate 4) · `PURPOSE` (Site inspection · client visit · …) · `PASSENGERS` (2).
- **`ELIGIBLE VEHICLES — MATCHED ON WINDOW, STATUS, SEATS, POOL SCOPE (FR-BOOK-02)`** — selectable list:
  - Nissan Patrol · AD 88914 · Yard A · 7 seats · ¾ tank · free 12:30–18:00 · buffer clear · **`RECOMMENDED`** (selected, green).
  - Toyota Corolla · AD 77129 · Yard B · 5 seats · ¾ tank · free 13:00–17:30.
  - Kia EV6 · AD 90044 · Yard A · charging 74% · free 14:10 · partial window fit.
- **`WHAT HAPPENS ON SUBMIT`** panel (coloured-dot bullets): "Routes to S. Al Hammadi (line manager or delegate) for approval — you raised it, so you cannot approve it (SoD-01)."; "On approval the employee signs digital consent before collection — consent cannot be signed by Fleet Ops on their behalf."; "Unique booking number issued; expected fuel computed from route + efficiency; reminders 24h and 1h out."
- **Footer:** helper "Check driver eligibility first." + **`Submit for approval →`** (disabled until eligibility checked).

#### `24-booking-create-emergency-breakglass.png` — Create booking · Emergency break-glass (Fleet Ops)
- **Context:** Same screen as `23` with **`Emergency — break-glass`** mode selected (red-outlined card).
- **Adds `EMERGENCY CATEGORY · REQUIRED`** segmented: **`Incident response`** (selected, red) · `Medical` · `Port ops disruption` · `VIP movement`.
- Driver + eligible-vehicles blocks identical to `23`.
- **`WHAT HAPPENS ON SUBMIT`** (different rules): "Booking confirms immediately with a unique number — no approval step (FR-BOOK-21)."; "Digital consent is still mandatory — R. D'Souza signs on his device at the key handover; keys cannot be released without it."; "Flagged BREAK-GLASS; category 'Incident response' · routed to Cluster Fleet Lead for post-hoc review within 24h · full audit trail."
- **Footer:** **`Confirm emergency booking →`**.
- **Rules:** Break-glass bypasses approval but never bypasses consent; always audited and routed for post-hoc review.

#### `25-booking-approvals-inbox.png` — Booking approvals (Fleet Mgr)
- **Context:** Fleet Mgr segment. Eyebrow `GROUP OPERATIONS`, title **Booking approvals**. Master–detail layout.
- **Left — pending queue** (cards: vehicle/summary + time-to-pickup + badges):
  - Nissan Patrol · 07:30–12:00 (4.5h) · `3h 40m` · `ELIGIBLE` `CONSENT ✓` `1ST THIS WEEK` (selected).
  - Toyota Hiace · 06:00–18:00 (12h) · `Tomorrow 06:00` · `ELIGIBLE` `12H DURATION — ESCALATED` (amber).
  - Toyota Land Cruiser · 09:00–15:00 (6h) · `1h 05m` · `ELIGIBLE` `CONSENT ✓`.
  - Substitute driver authorisation · 5-day window · `25m` · `SUBSTITUTION — LIABILITY SHIFTS` (amber).
- **Right — request detail:** avatar `Amina Khoury` · `EMP-20481 · Reports to you · 14 bookings YTD, 0 no-shows, 1 late return` · ref `BK-1211`.
  - Fact row (4): `VEHICLE Nissan Patrol · AD 88914` · `WINDOW Mon 13 Jul · 07:30–12:00 (4.5h)` · `PURPOSE Site visit · 2 passengers` · `EST. COST AED 96 · fuel 7.4L + wear`.
  - **`SYSTEM VERDICTS`** (stacked banners):
    - ✓ `Eligibility gate passed` — "Employment active · licence valid to 02/2027 · no black-point or behaviour blocks".
    - ✓ `Consent v3.2 signed` — "08:12 · iOS · covers fines, damages, usage policy".
    - ✓ `No conflicts on vehicle` — "Previous booking ends 06:45 · 15-min buffer respected · Mulkiya + insurance current".
    - ⚠ `Monday 07:30 is pool peak` (amber) — "GS Pool forecast 88% at pick-up · a 09:00 start would free a vehicle for the waitlist".
  - **`JUSTIFICATION`** blockquote: "Quarterly HSE inspection at the Kezad 280 site office with two auditors. Client contact confirmed for 09:00; need buffer for gate clearance."
  - **Action bar:** **`Approve`** (navy) · `Request change` (secondary) · `Decline…` (red outline). Note: "You cannot approve requests you raised (SoD-01) — those route to your delegate."
- **Components:** Master–detail list, badge chips, verdict banners, justification blockquote, action bar.

---

### HANDOVER & RETURN

#### `26-handover-custody-register-list.png` — Handover & return · custody register (Fleet Mgr, Helm skin)
- **Context:** Fleet Mgr segment, **Helm** skin. Eyebrow `GS POOL · MINA ZAYED · CUSTODY REGISTER (APPEND-ONLY)`, title **Handover & return** (page label `Vehicle handover`). Top-right buttons: **`Log return`** (secondary) + **`+ New handover`** (primary).
- **Filter tabs:** `All` (active) · `On trip` · `Charges / damage` · `On time`. Right caption `11 records · last 14 days`.
- **Table columns:** `BOOKING` · `DRIVER` · `VEHICLE` (make/model + plate) · `ISSUED → RETURNED` · `KM` · `CHARGES` · `STATUS` · row actions (`View` + `Edit`/`Locked`).
  - BK-1198 · S. Al Hammadi · Toyota Corolla AD 77120 · 08:10 → — · — · — · `ON TRIP` (green) · View / **Edit**.
  - BK-1192 · M. Rashed · Kia EV6 AD 90044 · Yday 13:00 → 17:42 · 124 · None · `ON TIME` (green) · View / `Locked`.
  - BK-1187 · A. Khoury · Nissan Patrol AD 88914 · Wed 09:00 → 15:20 · 232 · AED 51 fuel · `LATE 20M` (amber) · View / `Locked`.
  - BK-1181 · K. Menon · Toyota Hiace AD 24410 · Tue 06:30 → 14:05 · 490 · AED 119 + damage · `DAMAGE` (red) · View / `Locked`.
  - BK-1176 · R. D'Souza · Land Cruiser AD 40213 · Mon 07:00 → 12:44 · 182 · Fine AED 400 · `FINE ATTACHED` (amber) · View / `Locked`.
- **Pagination:** `Page 1 of 3 · showing 5 of 11` + `← Prev` / `Next →`.
- **Footnote:** "View shows the complete issue → return chain. Completed records are append-only — corrections are logged as amendments, never overwrites. Editing is available only while a trip is open."
- **Components:** Filter tab group, DataTable with status badges + conditional row actions, pagination, header action buttons.
- **Rules:** Append-only custody register; only `ON TRIP` rows are editable (others `Locked`). `+ New handover` → the walkaround flow (`27`, Wayfinder). `View` → full issue→return chain (not supplied as a separate screen).

#### `27-handover-return-walkaround-inspection.png` — Handover & return · walkaround (Wayfinder skin, Handover mode)
- **Context:** Wayfinder shell (dark-green rail). Eyebrow `FLEET MANAGER · GS POOL`, title **Handover & return**. Top-right mode toggle **`Handover`** (selected) / `Return`.
- **Booking header card:** `BOOKING` BK-1204 · `VEHICLE` Nissan Patrol · AD 88914 · `DRIVER` Amina Khoury; sub-line "✓ ELIGIBILITY GATE PASSED · NO BLOCKS · CONSENT V3.2 SIGNED 08:12"; right green pill **`● GPS ONLINE`**.
- **Left panel — `Walkaround inspection` (`2 OF 5`):** checklist rows each with **PASS / FAIL** toggle buttons (PASS green when set):
  - `Body panels & glass` — "no new damage vs last return record" (PASS).
  - `Tyres & spare` — "tread visual · pressure warning light off" (PASS).
  - `Lights & indicators` — "head, brake, hazard" (unset).
  - `On-vehicle assets` — "Salik tag · Darb tag · fuel card FC-2291 · first-aid kit" (unset).
  - `Cabin condition` — "clean · no personal items from previous booking" (unset).
- **`Odometer & fuel` block:** green chip `TELEMATICS MATCHED`; fields `STARTING ODOMETER`, `FUEL LEVEL — 7⁄8` (partially visible).
- **Right panel — `Condition capture`:** helper "Tap the diagram to pin any damage; attach a photo as evidence." Car top-down **diagram** with damage pins (pin `1` = "Existing mark · previous booking" → `LOGGED`). Note: "Existing marks carry over from the last return. New pins are timestamped, photographed and countersigned — they become evidence, not argument." Below: `VEHICLE PHOTOS — HANDOVER` with `Capture` control.
- **Sticky footer bar:** left status "3 items left: 3 checks · key · signature"; right primary **`Hand over keys`**.
- **Components:** Mode toggle, PASS/FAIL segmented controls, evidence diagram with pins, photo capture, progress counter, sticky action bar. **RTL:** `العربية` toggle present — mirror layout for AR.

---

## 5. Cross-cutting implementation notes

- **Prototype chrome to drop:** the top browser-tool bar (`100%`, Comment, Tweaks, Edit, Present, Share) and the "D" avatar in the very top-right are the mockup tool's UI — do **not** build them.
- **Role/segment drives nav + data masking:** Fleet Mgr vs Admin change the left nav and page eyebrow; lifetime-cost and IBAN are role-masked.
- **AI assistant** ("Ask Helm AI" / "Ask AI") is a persistent top-bar entry point on every screen — stub as a button opening a side panel.
- **Wizards** share one pattern: left numbered step-rail (done/current/pending states) + SoD footnote + `Back`/`Continue →` footer; final step is a review summary with ✓/⚠ rows and a gated primary action (submission allowed, activation/approval gated on completeness).
- **Status vocabulary** is consistent — reuse a single Badge component with variants: `valid/active/on-track/linked/enabled/included` (green), `pending/on-approval/ends-soon/missing` (amber), `expired/hard-block` (red).
- **Tables**: uppercase muted headers, monospace for IDs/dates/amounts, right-aligned numerics, selectable rows where a detail pane exists.
- **Bilingual/RTL** is required (AR toggle shown in Wayfinder); build all copy through i18n and support RTL mirroring per `app-ui/src/**` i18n instructions.
- **Alert ladders** (90/60/30 etc.) are configurable per tenant and appear both on vehicle compliance and vendor/lease terms.

---

## 6. Coverage gaps — screens/tabs referenced but NOT supplied

Flag these before implementation; each nav item or tab visible in the mockups that has **no** corresponding screen:

### Missing tabs within supplied screens
1. **Vehicle detail → `Overview` full-page tab** — resolved by `vehicle-overview-tab.png`; quick-view drawer `15` remains a separate list interaction.

> **Resolved in latest passes:** onboarding **Step 1** (`10`), **All vehicles list** (`09`), **vehicle quick-view / Overview drawer** (`15`), **Employee Book a vehicle** (`21`), **Dedicated request** (`22`), **Create booking** on-behalf + emergency (`23`, `24`), **Booking approvals** (`25`), and the **Handover custody register** (`26`) are all now supplied.

### Missing whole modules referenced in the left nav (no screens at all)
Fleet Manager nav items with **no mockup**:
2. `Ops dashboard`
3. `Compliance & alerts`
4. `Fines & black points`
5. `Live map` (a map appears in the vehicle Telematics tab and the quick-view drawer, but the standalone Live map screen is missing).

Admin nav items with **no mockup**:
6. `Admin console`, 7. `Policies & rules`, 8. `Users & access`, 9. `Organization`, 10. `Lookup management`, 11. `System & integrations`.

Wayfinder nav items with **no mockup** (only `Handover & return` supplied):
12. `Booking & consent`, 13. `Approval inbox`, 14. `Entitlement decision`, 15. `Command console`, 16. `Fines & black points`, 17. `Executive dashboard`.

### Missing flows / states (across all supplied screens)
- Handover **`Return`** mode (only `Handover` mode of `27` shown); the register **`View`** issue→return chain and the **`Log return`** result screen.
- **Dedicated vehicle decision / allocation (D2)** — only the `22` request entry is shown; the eligibility-result, approval, consent and allocation/BSD screens are missing.
- **Booking confirmation / consent-signing / booking-number** screen after `Book`, `Submit for approval` or `Confirm emergency booking`.
- **My bookings**, **waitlist**, and the **substitute-driver authorisation** detail (referenced in the `25` queue) — not supplied.
- No **empty / loading / error** states supplied.
- No **Arabic / RTL** renders supplied (toggle present but not evidenced).
- No **mobile / responsive** (320 / 768 / 1024) renders — all desktop ~1440.
- No **rejection / approval-failure** variants for the wizards or approvals.

> **Bottom line:** Vehicle management now includes list, quick view, onboarding and all detail tabs including Overview. Missing Booking, Dedicated and Handover outcome screens are authorized for derivation from the corresponding phase requirements and the existing design system; they are not permission to invent business behavior.

---

## 7. Link / flow audit — connected pages that a clickable element points to but is NOT supplied

Every interactive element below is visible in a supplied mockup, but the **destination page/panel it links to is missing**. These are the "connected pages" gaps (distinct from the nav-item gaps in §6).

| # | Source screen | Clickable element | Expected destination (missing) |
| --- | --- | --- | --- |
| L1 | `01` vendor master, `02` lease contracts | Contract refs `LC-2021-0033`, `LC-2023-0290`, `LC-2024-0128`, … (monospace links) | **Single lease-contract detail page** (terms, vehicles on contract, penalty history) |
| L2 | `02` lease contracts | "Expired — renewed as **LC-2026-0021**" | **Renewal / new-contract detail** (renewal-chain view) |
| L3 | `01`, `02` | Vendor name (AutoLease Gulf, etc.) | **Vendor profile page** (beyond the inline right-hand card) |
| L4 | `03` off-hire & discrepancies | Off-hire workflow cards + 5-step tracker | **Off-hire workflow detail / action page** (initiate → condition report → penalty → ack → returned) |
| L5 | `03` | Discrepancy cards ("→ Finance + Procurement") | **Discrepancy resolution / credit-note page** (or external Finance handoff) |
| L6 | `16` vehicle detail — Ownership & lease | **`Start off-hire workflow →`** button | Same off-hire workflow as L4 — **missing** |
| L7 | `08` vendor onboarding | **`Submit for approval →`** | **Post-submit confirmation + Procurement approval inbox/decision** page |
| L8 | `14` vehicle onboarding | **`Activate vehicle →`** | **Post-activation confirmation / redirect to vehicle detail Overview** |
| L9 | `09` list + `10`–`14` onboarding rail | **`Import / migrate`** (button + bulk CSV footnote) | **Vehicle import / migration wizard** (CSV upload, validation, dedup, steward sign-off) |
| L10 | `04` vendor onboarding | **`Look up`** (Fusion supplier ID) | **Fusion supplier lookup result / picker** (search + select state) |
| L11 | `17` vehicle detail — Compliance | Document **`view`** + version links (`v3 · view`, etc.) | **Document viewer / vault version history** panel |
| L12 | `05`, `13` wizards | **`Upload scan`** buttons | **Upload + OCR review/confirm** modal (extracted fields → confirm) |
| L13 | `16`–`20` vehicle detail | **`← All vehicles`** back-link | **`09` All vehicles list** — now supplied ✓ |
| L14 | `16`–`20` | **`Overview`** tab | `vehicle-overview-tab.png` ✓ |
| L15 | `27` handover walkaround | Mode toggle **`Return`** | **Return-mode** handover screen (only Handover mode supplied) |
| L16 | `27` handover walkaround | **`Hand over keys`** primary action | **Handover completion / e-signature / receipt** confirmation |
| L17 | `27` handover walkaround | "CONSENT V3.2 SIGNED" reference | **Consent document viewer** (versioned consent record) |
| L18 | `27` handover walkaround | **`Capture`** / tap-diagram photo pins | **Camera / photo-evidence capture** flow + annotated result |
| L19 | All Helm screens | **`Ask Helm AI`** / **`Ask AI`** top-bar button | **AI assistant side panel** |
| L20 | All screens | **`View driver mobile app`** (bottom affordance) | **Driver mobile app** preview/screens |
| L21 | `18` vehicle detail — Telematics | Map pin / zoom controls, **`Live map`** nav | **Standalone Live map** page (also §6 #5) |
| L22 | Top bars | Notifications bell, user avatar/chip, dark-mode & `العربية` toggles | **Notifications panel, profile/account menu** (no states supplied) |
| L23 | `21` Book a vehicle | **`Book`** on a vehicle card | **Consent-signing + booking-number confirmation** (not supplied) |
| L24 | `22` dedicated, `23` create booking | **`Check eligibility`** | **Eligibility-result** panel/state (pass/block reasons) |
| L25 | `23` create booking | **`Submit for approval →`** | **Post-submit confirmation** (routes into `25` approvals; confirmation screen not supplied) |
| L26 | `24` create booking | **`Confirm emergency booking →`** | **Break-glass confirmation / receipt** (not supplied) |
| L27 | `25` approvals | **`Approve`** / `Request change` / `Decline…` | **Approval outcome / notify states** (not supplied) |
| L28 | `26` handover register | **`+ New handover`** / **`Log return`** / row **`View`** | New handover → `27` walkaround ✓; **`Log return`** flow and record **`View`** chain not supplied |

### Interpretation
- **Vendor cluster is self-consistent for its wizard**, but its *contract-level* and *off-hire-workflow* detail pages (L1, L2, L4, L6) are the biggest missing connected pages — multiple screens link into them.
- **Vehicle cluster** now has its list (`09`), quick-view drawer (`15`) and full onboarding wizard; remaining unshown destinations are the full-page **Overview** tab (L14), the **Import/migrate** wizard (L9) and post-activation confirmation (L8).
- **Booking cluster** covers request → create → approvals, but the **post-action confirmation / consent-signing** screens (L23, L25, L26), the **eligibility-result** state (L24) and **approval outcomes** (L27) are unshown.
- **Handover** now has the register (`26`) and walkaround (`27`), but `Return` mode, completion/receipt, consent viewer, `Log return` and the record `View` chain (L15–L18, L28) are unshown.
- **Global shells** (AI panel, driver mobile app, notifications/profile — L19, L20, L22) are referenced on every screen but never mocked.

> Net: **yes — connected pages are still missing.** The supplied 27 screens are mostly *entry points, lists and wizards*; the *detail/outcome targets they link to* (single contract, off-hire workflow, document viewer, import wizard, booking confirmations/consent, dedicated decision, handover Return/complete, AI panel, driver app) are not in this set and should be requested before build.

---

## 8. Critique log — spec reconciled against real BE (`app-api`) and FE (`app-ui`)

Two rigorous review passes were run against the actual codebase. Findings and their resolution are recorded here so the spec is a faithful build contract, not just a screenshot transcription.

### Pass 1 — spec vs Backend (`app-api` contracts, enums, routes, rules)

| # | Finding | Severity | Resolution in this spec |
| --- | --- | --- | --- |
| B1 | **No vendor domain exists in the backend.** There is no `vendors`/`lease-contracts` module, contract, table, or route. Vendors survive only as `vehicle.vendorId` (FK) + `vehicle.leaseContractRef` (text). Screens `01`–`08` (vendor master, scorecard, lease contracts, off-hire workflow, vendor onboarding) have **zero** BE support. | **High** | Reclassified in §6/§11 as a **backend build gap**, not merely "supplied mockups". Vendor screens cannot be wired until a vendor/lease domain is built. |
| B2 | **Vehicle "status" is three BE fields, not one.** Mockup list `LIFECYCLE` column mixes values from `lifecycleStatus` (`Active, InUse, UnderMaintenance, OffHirePending, Decommissioned, Sold, Transferred`), `operationalStatus` (`Reserve, Standby, VIPOnly, Quarantined, TemporaryHold`), and `assignmentModel` (`Pool, Dedicated`). "Reserve" = operationalStatus; "Dedicated" = assignmentModel. | **High** | §9 maps each UI column to the correct BE field; the list must render `lifecycleStatus` for LIFECYCLE and surface `assignmentModel`/`operationalStatus` separately (or as sub-badges). |
| B3 | **Enum casing.** BE enums are PascalCase (`InUse`, `UnderMaintenance`, `OffHirePending`); UI shows spaced Title Case ("In Use"). | Med | §9 lists canonical enum → i18n display-label mapping; never hardcode display strings. |
| B4 | **Dedicated request: 2×2 UI vs single enum.** Mockup `22` shows two independent toggles — Request type (`Long-term`/`Temporary`) **and** Driver option (`With driver`/`Without driver`). BE `entitlementRequestTypeSchema` was a **single** enum `LongTerm \| Temporary \| WithDriver \| WithoutDriver` (not a cross-product), and `createEntitlementSchema` had no driver-option field. | **High** | ✅ **Resolved (2026-07-22):** split into two orthogonal fields — `requestType` = `LongTerm \| Temporary` (duration) **+** new `driverOption` = `WithDriver \| WithoutDriver` (migration `0033`, nullable `driver_option` column). Both round-trip through create + DTO (`entitlement.int-spec`). Driver option is **not** yet a policy-routing fact (open follow-up if it should affect the approval chain). |
| B5 | **Emergency / break-glass booking is not modelled.** Mockup `24` shows a break-glass mode + `EMERGENCY CATEGORY` (`Incident response`/`Medical`/`Port ops disruption`/`VIP movement`) that "confirms immediately, no approval". BE `createBookingSchema`/`bookingStatusSchema` have **no** break-glass flag, emergency-category enum, or no-approval path. On-behalf **is** supported (`requestedByPersonId`). | **High** | **Decision (2026-07-22):** build **on-behalf (`23`) now** (no BE change); **defer emergency (`24`)**. Firm constraint when built: break-glass bypasses **approval only** — never compliance **hard-blocks** or **consent**. Also needs a role gate, emergency category as a **lookup** (configurable), and a 24h post-hoc review task to the Cluster Fleet Lead. |
| B6 | **Approvals "pool peak 88%" verdict** has no BE source. Eligibility (`POST /compliance/eligibility` → ALLOW/DENY + reasons), consent, and the `booking_no_double_book` exclusion constraint back the other three verdicts; demand-forecast/peak is not implemented. | Med | §9 marks the peak-forecast verdict as **analytics gap**; the other three verdicts map to real BE outputs. |
| B7 | Handover register display statuses (`ON TRIP`/`ON TIME`/`LATE 20M`/`DAMAGE`/`FINE ATTACHED`) are **derived**, not raw enums. BE has `phase` (`Handover`/`Returned`) + booleans `lateReturn`, `fuelDeviationFlagged`, `odometerConflict`, `damage[]`; "FINE ATTACHED" belongs to the fines domain. | Med | §9 documents the derivation rules for the register status chip. |
| B8 | Booking buffer, max-duration, approval-chain, consent version, alert ladders (60/30/14/7/1 insurance & registration; 30/14/7/1 licence), hard-block on expired mulkiya/insurance — all exist as **policy rules (fixtures)**, several decision-gated (D3/D6/D8/D9). Mockup values (15-min buffer, 90/60/30 ladder) partly differ from BE defaults. | Med | §9 cites the governing rule types; note the mockup's "90/60/30" vendor ladder is **not** the BE compliance ladder (60/30/14/7/1) — reconcile per domain. |

### Pass 2 — spec vs Frontend (`app-ui` design system, routes, components, i18n)

| # | Finding | Severity | Resolution in this spec |
| --- | --- | --- | --- |
| F1 | **Design-system mismatch.** Spec §2 described two skins, teal `#0F3D3E` brand, olive `#9A8348`, ~12px radius, and a monospace face. The implemented system is a **single Wayfinder** theme: navy `#0b3d5c`, gold `#e2a33d`, cream `#f5f3ec`, 3px radius, IBM Plex Sans + `tabular-nums` (no mono). | **High** | §2 **rewritten** to the real `index.css` tokens; "Helm vs Wayfinder" downgraded to mockup-source labels only. |
| F2 | Reusable components already exist and should be named, not reinvented: `patterns/DetailDrawer` (Sheet) for the quick-view drawer; `patterns/AvailabilityStrip` for the booking Gantt; `patterns/DamageMarker` + `SignaturePad` + `CameraCapture` for handover; `SignalCard`/`StatCard` for KPI tiles; `DataTable`, `Tabs`, `Pagination`, `Banner`, `PageHeader`, `AdminPageLayout`, `EmptyState`, `AuditMetaFooter`. | Med | §10 maps each screen's generic components to these concrete primitives. |
| F3 | **Routing is locale-first** (`/:lang/…`) with role guards; several target screens are `ComingSoonPage` placeholders, and **vehicle detail has no route at all**. | **High** | §10 gives the EXISTS / COMING-SOON / MISSING status + route for every screen. |
| F4 | **Handover FE exists but its mutations are not wired** to `POST /handovers`, `/return`, `/damage`. | High | §10/§11 record this as the top wiring gap. |
| F5 | i18n uses a single `translation` namespace (EN/AR), RTL wired via `/:lang` + `<html dir>`. Per `.github/instructions/ui-i18n.instructions.md` (applyTo `app-ui/src/**`), **all** new copy must be keyed. | Med | §2 + §10 note i18n key requirement and existing `vehicleManagement.metrics.*` keys. |
| F6 | Vehicle-list KPIs in FE (`total/available/inUse/maintenance/blocked`) already match the mockup's five tiles. | Low (good) | §9 aligns tile → metric key. |

---

## 9. Backend contract traceability (verified — `app-api`)

Per functional area: the real module, routes, key DTO fields, and enums to bind each screen to. Money is `numeric(14,2)` returned as **string**; dates are ISO; enums are PascalCase.

### Vehicle management (screens `09`–`20`) — module `app-api/src/modules/vehicles`
- **Routes:** `GET /api/v1/vehicles` (list), `GET /vehicles/:id`, `GET /vehicles/:id/history` (lifecycle timeline → screen `20`), `POST /vehicles` (onboard), `PATCH /vehicles/:id`, `POST /vehicles/:id/transition` (lifecycle change), `POST /vehicles/:id/documents` (compliance docs → screen `17`), `POST /vehicles/:id/transfer` (node transfer).
- **List/detail fields (`VehicleDto`):** `plate, chassisVin, makeCode, modelCode, year, colour, bodyTypeCode, useCategoryCode, seatingCapacity, fuelTypeCode, fuelEfficiencyKmpl, ownership, purchaseOrLeaseStart, leaseEnd, monthlyRental, currency, leaseContractRef, lifecycleStatus, operationalStatus, lastConfirmedOdometer, bookingPoolFlag, assignmentModel, assignedDriverPersonId, fuelCardNumber, salikTag, darbTag, trackerVendor, trackerSerial, gpsStatus, mulkiyaNumber, mulkiyaExpiry, insuranceProvider, insurancePolicyNumber, insuranceExpiry, hierarchyNodeId/Name/NameAr`.
- **Column → field:** VEHICLE=`makeCode`+`modelCode`+`plate`; HIERARCHY NODE=`hierarchyNodeName`; **LIFECYCLE=`lifecycleStatus`**; OPERATIONAL=`operationalStatus`; GPS=`gpsStatus`; MULKIYA=`mulkiyaExpiry`; INSURANCE=`insuranceExpiry`. `Dedicated` badge = `assignmentModel==='Dedicated'`.
- **Enum display map:** `InUse`→"In Use", `UnderMaintenance`→"Under Maintenance", `OffHirePending`→"Off-hire Pending", `VIPOnly`→"VIP Only", `TemporaryHold`→"Temporary Hold".
- **Onboarding (`10`–`14`) → `createVehicleSchema`:** scenario = `ownership` (`Owned`/`Leased`) + lease fields; identity = `plate, chassisVin, makeCode, modelCode, year, useCategoryCode, seatingCapacity, fuelTypeCode, fuelEfficiencyKmpl`; hierarchy = `homeNodeId`, `operationalStatus`, `bookingPoolFlag`; compliance/telematics = `mulkiya*`, `insurance*`, `fuelCardNumber, salikTag, darbTag, trackerVendor, trackerSerial, gpsStatus`; docs via `POST /vehicles/:id/documents` (`docTypeCode, issueDate, expiryDate, blobRef`).
- **Rules:** bookable ⇔ `lifecycleStatus==='Active' && bookingPoolFlag===true`; expired mulkiya/insurance = hard block (compliance `hard-block-conditions`).

### Booking (screens `21`, `23`, `24`, `25`) — module `app-api/src/modules/bookings`
- **Routes:** `GET /api/v1/vehicles/available?pickupAtUtc&returnAtUtc&seatingCapacity` (screen `21`/`23` eligible list), `POST /bookings` (draft; `vehicleId, driverPersonId, requestedByPersonId, pickupAtUtc, returnAtUtc, destination, purpose, passengerCount`), `POST /bookings/:id/consent` (signs + **issues `bookingNumber`**), `POST /bookings/:id/submit` (routes to approval), `POST /bookings/:id/approve|decline|request-changes` (screen `25`), `PATCH /bookings/:id`, `POST /bookings/:id/extend|cancel`, `GET /bookings/:id/events`.
- **Statuses:** `Draft, PendingApproval, Approved, Active, Completed, Declined, Cancelled, Expired, NoShow`. Only `PendingApproval/Approved/Active` hold the reservation (`booking_no_double_book` btree_gist).
- **On-behalf (`23`)** = `requestedByPersonId ≠ driverPersonId`. **SoD-01**: requester excluded from approvers.
- **Buffer:** `bufferMinutes` (Pool 15 / Executive 30) → mockup "15-min buffer respected". **Approval chain:** ≤4h LineManager; ≥24h LineManager→FleetManager.
- **Approvals verdicts (`25`):** eligibility ← `POST /compliance/eligibility` (ALLOW/DENY + `reasons`); consent ← `consent_record.consentDocumentVersion`; conflicts ← exclusion constraint + buffer; **pool-peak forecast = not implemented**.

### Dedicated / entitlements (screen `22`) — module `app-api/src/modules/entitlements`
- **Routes:** `POST /api/v1/entitlements` (create), `GET /entitlements`, `GET /entitlements/:id`, `POST /entitlements/:id/submit` (screen `22` "Check eligibility"), `/approve`, `/decline`, `/consent`, `/allocate` (D2 allocation), `/bsd-windows` (leave auto-revert), `/cancel`.
- **`createEntitlementSchema`:** `requestType (LongTerm|Temporary|WithDriver|WithoutDriver), requesterPersonId, justificationCategory, justificationText, vehicleCategoryCode, durationStart, durationEnd, locationNodeId, businessUnit, costCentre`.
- **Mismatch (B4):** mockup's 2×2 (type × driver) does not map to the single `requestType` enum — resolve before building. **SoD-02**; chain LineManager→FleetManager→ClusterCEO; dedicated eligibility DENY-by-default (D8).

### Handover (screens `26`, `27`) — module `app-api/src/modules/handover`
- **Routes:** `POST /api/v1/handovers` (open → booking `Active`; `bookingId, employeePersonId, startOdometer, startFuelEighths, gpsStatus, keyIssueRef, signatureRef, checklist[], existingDamage[]`), `GET /handovers/:id`, `POST /handovers/:id/return` (`endOdometer, endFuelEighths, returnCondition, keyReturnRef, signatureRef, newDamage[]`), `POST /handovers/:id/damage`, `GET /vehicles/:id/keys` (custody log).
- **Fields:** `phase (Handover|Returned)`, `startFuelEighths/endFuelEighths` (0–8 → "7⁄8"), `damage[]` (`x,y` 0..1, `region, state existing|new, photoRef`), flags `lateReturn, fuelDeviationFlagged, odometerConflict`.
- **Register status derivation (`26`):** `ON TRIP`=`phase==='Handover'`; `ON TIME`=`Returned && !lateReturn`; `LATE …`=`lateReturn`; `DAMAGE`=`damage.some(state==='new')`; `FINE ATTACHED`=fines domain link. Editable only while `phase==='Handover'`.

### Compliance / eligibility (verdicts, hard-blocks) — module `app-api/src/modules/compliance`
- `POST /compliance/eligibility` → `{decision: ALLOW|DENY, reasons[], dataAsOf, policyVersion}`; `compliance_item.status` = `Valid|ExpiringSoon|Expired`; alert ladders insurance/registration `[60,30,14,7,1]`, licence `[30,14,7,1]`.

---

## 10. Frontend implementation status & component mapping (verified — `app-ui`)

Routes are locale-prefixed (`/:lang/…`). Legend: ✅ built · ⏳ ComingSoon placeholder · ❌ no route/page.

| Screen | Route | Component / page | Status | Reuse / build notes |
| --- | --- | --- | --- | --- |
| `01`–`03` vendor master/lease/off-hire | `/admin/vendors-leases` | `VendorsPage` (`features/vendors`) | ✅ partial | **Delivered:** vendor master `DataTable` + detail `Sheet` (fields, lease contracts, SoD lifecycle actions) + onboarding create form, wired to the vendor API (list/create/submit/approve/reject/suspend/reactivate/retire, lease list). i18n EN/AR + MSW + 3 page tests. **Remaining:** full 5-step onboarding wizard (`04`–`08`), lease **create** form, and off-hire/scorecard (need maintenance/invoice data). |
| `04`–`08` vendor onboarding | — | — | ❌ | Blocked on BE (B1). Wizard pattern like vehicles. |
| `09` all-vehicles list | `/vehicles` | `VehicleManagementPage` | ✅ | KPI tiles = `SignalCard` (`vehicleManagement.metrics.*`); table = `DataTable`. Fix LIFECYCLE column to `lifecycleStatus` (B2). |
| `10`–`14` vehicle onboarding wizard | `/vehicles/onboard` | `VehicleOnboardingPage` | ✅ | 5-step wizard exists (scenario→details→compliance→telematics→review). Verify fields vs `createVehicleSchema`. |
| `15` vehicle quick-view drawer | (from list row) | — | ❌ | Build with `patterns/DetailDrawer` (Sheet) reading `GET /vehicles/:id`. |
| `16`–`20` vehicle detail tabs | `/vehicles/:id` | — | ❌ | **No route/page.** Build detail page with `Tabs`; Overview + 5 tabs; `POST /vehicles/:id/documents`, `GET /:id/history`, `GET /:id/keys`. |
| Vehicle import/migrate | `/vehicles/import` | `ComingSoonPage` | ⏳ | Bulk CSV wizard (L9). |
| `21` employee book-a-vehicle | `/booking` | `BookVehiclePage` | ✅ | Gantt = `patterns/AvailabilityStrip`; uses `GET /vehicles/available`, `POST /bookings`, `/consent`, `/submit`. |
| `22` dedicated request | `/dedicated-vehicle` | `ComingSoonPage` | ⏳ | Build against `POST /entitlements` — **resolve 2×2 vs enum (B4) first**. |
| `23` create booking (on-behalf) | `/bookings/create` | `ComingSoonPage` | ⏳ | Buildable now (`requestedByPersonId`); eligibility via `/compliance/eligibility`. |
| `24` emergency break-glass | — | — | ❌ | **Blocked on BE (B5)** — no break-glass model. |
| `25` booking approvals inbox | `/approvals` | `ComingSoonPage` | ⏳ | Master–detail (`AdminPageLayout`); verdicts from eligibility+consent+conflicts; peak-forecast is analytics gap (B6). |
| `26` handover register list | `/handover` | `HandoverPage` | ✅ (list) | Table + filter tabs + `Pagination`; wire to handover list read. |
| `27` handover walkaround | `/handover` (flow) | `HandoverPage` | ✅ UI / ⚠ unwired | `DamageMarker`, `SignaturePad`, `CameraCapture`, fuel `Slider`. **Mutations not wired (F4)** — wire `POST /handovers`, `/return`, `/damage`. |

**Shared primitives available:** `Button, Badge, StatusChip, Card, Tabs, Dialog, Sheet, DataTable, Table, Input, Select, Textarea, Checkbox, RadioGroup, Switch, Slider, ScrollArea, Popover, Accordion, Tooltip, Separator, Spinner, Skeleton, Pagination, Alert, Avatar, Calendar, DatePicker, Combobox, DropdownMenu, SignalCard, PageHeader`; patterns `DetailDrawer, ResourceTable, ResourceFormDialog, DamageMarker, SignaturePad, CameraCapture, AvailabilityStrip, EmptyState, StatCard, AdminPageLayout, Banner, FilterBar, AuditMetaFooter`. API via typed `apiClient` + Zod `.contract.ts` + TanStack Query `use-*` hooks; contract-drift guard enforces FE↔OpenAPI parity.

---

## 11. Consolidated BE + FE gap register (build order)

Ordered by dependency. "BE" = backend work in `app-api`; "FE" = frontend work in `app-ui`.

1. **Vendor & lease domain (BE, then FE)** — ✅ **backend delivered** (`app-api/src/modules/vendors`): `vendor` + `lease_contract` tables (migration `0032`), `vendor.contract.ts`, CRUD + Procurement-approval lifecycle (SoD), lookup-validated categories, IBAN masking, and a **plug-and-play source seam** (`sourceMode` + `VENDOR_SOURCE_PROVIDERS` strategy: `ManualVendorProvider` active, `IntegratedVendorProvider` a future-scope stub). Covered by `test/vendor.int-spec.ts` (7 passing). ✅ **FE master slice delivered** (`app-ui/src/features/vendors`, route `/admin/vendors-leases`): list + detail drawer + create + lifecycle actions + lease view, EN/AR i18n, MSW, 3 page tests. **Remaining FE:** 5-step onboarding wizard (`04`–`08`), lease-contract create form, and off-hire-workflow + computed scorecard (depend on maintenance/invoice data — future).
2. **Vehicle detail page + quick-view drawer (FE)** — screens `15`–`20`; BE routes already exist (`GET /vehicles/:id`, `/history`, `/keys`, `POST /:id/documents`). No route today.
3. **Wire handover mutations (FE)** — `27` UI exists but unconnected (F4); connect to `POST /handovers`, `/return`, `/damage`, `GET /vehicles/:id/keys`.
4. **Booking approvals inbox (FE)** — `25`; BE approve/decline/request-changes + eligibility exist; peak-forecast verdict is an analytics gap (B6).
5. **Create booking on-behalf (FE)** — `23`; buildable now.
6. **Dedicated request (FE) + model decision** — `22`; ✅ **model resolved & delivered in BE** (`requestType` + `driverOption`, migration `0033`). FE can now build against the two-axis contract.
7. **Emergency / break-glass booking (BE, then FE)** — `24`; **deferred** by decision (2026-07-22). When scheduled: bypass **approval only** (never hard-blocks/consent), add a break-glass channel + emergency-category **lookup**, a role gate, and a 24h post-hoc review task. On-behalf (`23`) is unblocked and buildable now.
8. **Vehicle list correctness (FE)** — fix LIFECYCLE column mapping and enum display labels (B2/B3).
9. **Cross-cutting still-missing screens** — vehicle Import wizard, booking confirmation/consent-signing result, handover Return mode + record `View` chain, and the nav modules with no screens (Ops dashboard, Compliance & alerts, Fines, Live map, most Admin/Wayfinder items).
10. **Ladder reconciliation (BE/product)** — align mockup "90/60/30" vendor ladder vs BE compliance ladders `[60,30,14,7,1]` / `[30,14,7,1]` (B8).

> **Autonomy note:** this pass aligned the *spec* to verified BE/FE truth and enumerated code gaps with a build order. It intentionally did **not** generate unreviewed BE/FE code for 27 screens; items 1–10 are the implementation backlog to execute (with review) next.
