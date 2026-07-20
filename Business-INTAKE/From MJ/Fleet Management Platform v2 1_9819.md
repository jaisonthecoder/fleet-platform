**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**AD** **PORTS** **GROUP** Enabling Global Trade

**PRODUCT** **REQUIREMENTS** **DOCUMENT**

**Fleet** **Management** **Platform**

A group-wide capability for fleet inventory, booking, entitlement,
compliance and accountability.

**VERSION** **2.0** DRAFT FOR REVIEW

Internal — AD Ports Group Page 1 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**Document** **Control**

||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 2 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**Contents**

**PART** **I** **—** **STRATEGIC** **FRAME**

> 01 Executive Summary
>
> 02 Problem Landscape & Opportunity 03 Outcomes & North Star
>
> 04 Scope: In, Out, Boundary

**PART** **II** **—** **OPERATING** **MODEL**

> 05 Cluster, Pool & Location Hierarchy 06 Personas & Stakeholders
>
> 07 Roles, Access & Segregation of Duties

**PART** **III** **—** **CAPABILITY** **ARCHITECTURE** 08 C1 Fleet
Master & Lifecycle

> 09 C2 Pool Vehicle Booking & Allocation
>
> 10 C3 Dedicated Vehicle Requests & Entitlements 11 C4 Handover, Return
> & Damage Capture
>
> 12 C5 Replacement Vehicles & Substitute Drivers 13 C6 Driver
> Eligibility, Compliance & Documents 14 C7 Fines, Black Points &
> Accidents
>
> 15 C8 Telematics, Live Tracking & Route Replay 16 C9 Fuel & Cost
> Capture
>
> 17 C10 Behaviour Scoring & Misuse Detection 18 C11 AI Optimisation &
> Right-Sizing
>
> 19 C12 ESG & Sustainability

**PART** **IV** **—** **PLATFORM** **FOUNDATIONS** 20 Vehicle Inventory
Data Model

> 21 Integrations Map
>
> 22 Reporting & Analytics 23 Alerts & Notifications
>
> 24 Audit, Overrides & Exception Management

**PART** **V** **—** **NON-FUNCTIONAL** **&** **GOVERNANCE** 25
Non-Functional Requirements

> 26 Compliance, Privacy & Security 27 Success Metrics & KPIs

**PART** **VI** **—** **DELIVERY** 28 Phasing & Roadmap

> 29 Risks, Assumptions, Dependencies 30 Open Decisions
>
> 31 User Journeys 32 Glossary

Internal — AD Ports Group Page 3 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**PART** **I**

**STRATEGIC** **FRAME**

**01** **Executive** **Summary**

AD Ports Group operates a fleet of more than 300 vehicles across
multiple clusters, sites and geographies. Today, vehicle inventory is
maintained manually across owners with inconsistent quality; only the
Group Services pool at Mina Zayed has a partial booking system (Vehicle
Allocation in Mehwar). Fines, accidents, fuel costs, lease agreements
and maintenance records sit in fragmented spreadsheets and email trails.
There is no single source of truth, no real-time visibility, and no
enforced accountability against the driver.

This PRD defines a group-wide Fleet Management Platform that
replaces the current fragmented setup. It combines a self-service
employee booking experience, a structured workflow for dedicated vehicle
entitlements, a fleet manager operations console, and a management
intelligence layer. The platform is underpinned by a governed vehicle
master, GPS telematics integration, OCR-based fuel cost capture from
Oracle invoices, automated compliance alerting, AI-driven optimisation,
behaviour scoring, ESG metrics, and digital consent against every
booking and entitlement.

Version 2.0 reorganises the document around twelve capability domains.
It adds the cluster and pool hierarchy that mirrors the group's
operating model, a structured Dedicated Vehicle Request module,
replacement vehicle and substitute driver workflows, behaviour scoring,
ESG reporting, and the black-points transfer enforcement requested under
FR-FINE-12. These additions originate from stakeholder feedback on v1.0.

> **ONE-LINE** **SUMMARY**
>
> A group-wide, role-based, AI-enabled fleet platform that replaces
> manual inventory and partial booking, governs entitlement for
> dedicated vehicles up to Cluster CEO, enforces driver accountability
> for fines and damages, captures ESG metrics, and gives Management a
> real-time view of utilisation, cost and risk across every cluster.

Internal — AD Ports Group Page 4 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**02** **Problem** **Landscape** **&** **Opportunity** **2.1** **What**
**Today** **Looks** **Like**

> • Vehicle inventory is maintained manually across multiple owners;
> data quality, completeness and freshness are inconsistent across
> entities.
>
> • Only Group Services Pool at Mina Zayed runs a partial booking
> system. Other sites rely on email, phone calls or walk-ins.
>
> • Fuel costs arrive as consolidated supplier invoices; per-vehicle
> fuel cost is not currently calculated or reported.
>
> • Traffic fines and accidents are tracked in disconnected logs. There
> is no automatic linkage between a fine, the booking and the driver who
> was operating the vehicle at the time.
>
> • Compliance documents (Mulkiya, insurance, lease agreements) are
> tracked manually with limited expiry visibility, creating operational
> and legal risk.
>
> • Dedicated vehicle entitlement decisions live in email chains;
> eligibility, justification and approval evidence are not consistently
> captured.
>
> • There is no group-wide visibility of fleet utilisation, cost-per-km
> or demand-vs-capacity mismatch — making capital allocation reactive
> rather than data-driven.

**2.2** **Where** **the** **Cost** **Sits**

The cost of the current state is a combination of (a) avoidable lease
and depreciation on under-used vehicles that no one challenges, (b)
fines and damages that cannot be attributed and therefore cannot be
recovered, (c) compliance lapses discovered after the fact, and (d)
management time consumed reconciling spreadsheets instead of making
decisions. Across the group's projected expansion footprint, the same
fragmented pattern is being recreated each time a new entity is
onboarded.

**2.3** **Why** **Now**

Fleet is a recurring source of operational, financial and reputational
risk that scales with the group's geographic expansion. Solving this
once, at the group level, prevents each new entity from re-creating the
fragmented pattern. The platform also creates the data foundation needed
for the broader D&T ambition of AI-enabled operational decisioning, ESG
reporting against group sustainability targets, and predictive
maintenance economics.

Internal — AD Ports Group Page 5 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**03** **Outcomes** **&** **North** **Star** **3.1** **North** **Star**

> **VISION**
>
> A single, AI-enabled fleet platform for AD Ports Group — where every
> vehicle, every booking, every entitlement, every fine, every accident
> and every fuel dirham is captured against one record, enforced by
> policy, governed by cluster, and visible in real time to the people
> accountable for it.

**3.2** **Outcomes** **the** **Platform** **Must** **Deliver**

||
||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 6 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**04** **Scope:** **In,** **Out,** **Boundary** **4.1** **In** **Scope**

> • Group-wide vehicle inventory master — owned, leased, transferred.
>
> • Cluster, pool and location hierarchy reflecting the AD Ports Group
> operating model.
>
> • Self-service employee booking with approval workflow, buffer
> enforcement, waitlists and smart recommendations.
>
> • Dedicated vehicle request workflow — long-term, temporary,
> with-driver and without-driver — including entitlement validation up
> to Cluster CEO and return-to-pool during leave.
>
> • Fleet manager handover, return, inspection and reconciliation flows;
> mobile damage capture in Phase 2.
>
> • Replacement vehicle assignment during maintenance or off-hire, with
> full audit chain linking the original vehicle, replacement vehicle,
> booking and driver.
>
> • Substitute driver authorisation with effective dates and automatic
> re-routing of operational records.
>
> • GPS / telematics integration for live location, odometer and route
> replay, where vendor APIs are available.
>
> • Fines and accidents register, with auto-linkage to booking and
> driver, plus black-points transfer workflow.
>
> • Maintenance scheduling, downtime metrics and vendor turnaround
> tracking for owned vehicles. • Fuel cost capture via Oracle invoice
> ingestion (OCR / NLP) with manual fallback.
>
> • Lease and ownership lifecycle (purchase, leasing, transfer,
> decommissioning, off-hire).
>
> • Driver eligibility validation against employment status and driving
> licence validity prior to booking. • Digital consent as a precondition
> to booking and entitlement confirmation.
>
> • Role-based access control, masked cost views, segregation of duties
> between approval, assignment and investigation.
>
> • Operational, financial, compliance and executive dashboards.
>
> • AI optimisation layer — utilisation, anomaly detection, cost
> outliers, predictive maintenance, fleet right-sizing.
>
> • Behaviour scoring and misuse pattern detection feeding HR
> escalation. • ESG and sustainability reporting — fuel, CO₂, EV /
> hybrid utilisation.
>
> • Audit log for overrides, bypasses, reassignments and compliance
> exceptions.

**4.2** **Out** **of** **Scope**

> • Heavy equipment (cranes, reach stackers, RTGs and similar) — managed
> under Asset / EAM systems, not this platform.
>
> • Shuttle buses operating fixed routes — managed under transportation
> operations, not this platform.
>
> • Driver licence issuance or renewal — handled by HR and Government
> Relations. The platform validates against status only.
>
> • Vehicle physical maintenance execution (workshop systems) — only
> schedules, costs and status are tracked.
>
> • Replacement of Oracle Fusion finance modules — this platform
> integrates with Oracle, it does not replace it.

Internal — AD Ports Group Page 7 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

> • Annual vehicle inspection as a separate field — covered under
> Mulkiya renewal.

**4.3** **Boundary** **Conditions**

> • Heavy equipment and shuttle buses may appear in inventory for cost
> reporting but shall not appear in any bookable pool.
>
> • Dedicated vehicles remain in inventory and analytics; they are
> simply excluded from the bookable pool by configuration.
>
> • Decommissioned and sold vehicles remain searchable for historical
> reporting; they are excluded from operational dashboards.

Internal — AD Ports Group Page 8 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**PART** **II**

**OPERATING** **MODEL**

**05** **Cluster,** **Pool** **&** **Location** **Hierarchy**

This section reflects stakeholder feedback: the platform shall model AD
Ports Group's operating reality — clusters above pools, pools above
locations — and govern fleet operations at each layer.

**5.1** **Hierarchy** **Model**

The platform shall support a three-level operational hierarchy:

> • **Cluster** — top-level operating unit (e.g. Ports, Logistics,
> Maritime & Shipping, Economic Cities & Free Zones, Digital,
> Corporate).
>
> • **Pool** — a logical fleet grouping that sits under a cluster (e.g.
> Khalifa Port Pool, Zayed Port Pool, Kezad HQ Pool). A cluster may have
> one or many pools.
>
> • **Location** — the physical site where a vehicle is designated or
> operated from (e.g. Kezad 280, Mina Zayed Yard B). A pool may operate
> from one or many locations.

**5.2** **Example** **Hierarchy**

||
||
||
||
||
||
||
||

**5.3** **Functional** **Requirements**

||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 9 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

||
||
||
||

Internal — AD Ports Group Page 10 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**06** **Personas** **&** **Stakeholders** **6.1** **Stakeholder**
**Map**

||
||
||
||
||
||
||
||
||
||
||
||
||

**6.2** **Persona** **Snapshots**

**Persona** **1** **—** **Employee** **/** **Driver**

> • **Goal.** Book a vehicle for a business trip without friction;
> understand cost and policy responsibility.
>
> • **Frustration** **today.** No clear self-service path. Unclear which
> vehicle is available. Manual paperwork.
>
> • **Key** **journey.** Search availability → submit booking → consent
> → collect vehicle → return vehicle.

**Persona** **2** **—** **Fleet** **Manager**

> • **Goal.** Keep vehicles serviceable, document handover and return,
> log fines and accidents accurately, manage lease compliance, manage
> replacements during downtime.
>
> • **Frustration** **today.** Manual inventory, fragmented logs, no
> driver accountability data when fines arrive.
>
> • **Key** **journey.** Receive booking notification → prepare vehicle
> → handover → return inspection → reconcile → escalate as needed.

**Persona** **3** **—** **Approver** **(Line** **Manager)**

> • **Goal.** Approve only legitimate business travel; avoid being a
> bottleneck. • **Frustration** **today.** Requests come over email or
> chat. No audit trail.
>
> • **Key** **journey.** Receive request → review justification →
> approve, decline or request modification.

**Persona** **4** **—** **Cluster** **CEO** **(Dedicated** **Vehicle**
**Approver)**

Internal — AD Ports Group Page 11 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

> • **Goal.** Approve dedicated vehicle entitlements that match grade,
> role and policy; surface exceptions.
>
> • **Frustration** **today.** Approval evidence is fragmented across
> email; periodic review of entitlements is hard.
>
> • **Key** **journey.** Receive entitlement request → review
> eligibility check, justification and supporting documents → approve or
> reject.

**Persona** **5** **—** **Group** **Services** **/** **Finance** **/**
**HR**

> • **Goal.** Visibility on cost per km, demand vs capacity, fines per
> user, vendor performance, dedicated-vehicle utilisation.
>
> • **Frustration** **today.** Data has to be manually consolidated from
> multiple entities.
>
> • **Key** **journey.** Dashboard review → drill-downs → policy
> decisions → disciplinary triggers.

**Persona** **6** **—** **Group** **Executive** **(GCEO** **/**
**GCDIO** **/** **GCFO** **/** **GCHRO)**

> • **Goal.** Real-time, group-wide fleet KPI snapshot for capital,
> cost, risk and ESG decisions.
>
> • **Key** **journey.** Open dashboard → utilisation, cost, accident
> trend, ESG, dedicated-vehicle inventory → ad-hoc query.

Internal — AD Ports Group Page 12 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**07** **Roles,** **Access** **&** **Segregation** **of** **Duties**
**7.1** **Roles** **&** **Access** **Matrix**

Cost data is masked for non-finance roles (Employee, Approver, HR,
Executive sees aggregated only).

**7.2** **Segregation** **of** **Duties**

The platform shall enforce segregation to prevent operational conflicts
of interest. This is a structural control, not an optional setting.

||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 13 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

||
||
||
||

Internal — AD Ports Group Page 14 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**PART** **III**

**CAPABILITY** **ARCHITECTURE**

Each capability is presented with: its outcome, business rules,
functional requirements, and notable edge cases.

**08** **C1** **Fleet** **Master** **&** **Lifecycle** **Outcome**

A single, governed group-wide vehicle master that supports every other
capability and reflects the cluster / pool / location operating model.

**Business** **Rules**

> • Every vehicle owned or leased by the group is recorded once,
> regardless of cluster.
>
> • Equipment and shuttle buses are recorded for cost purposes but never
> appear in a bookable pool.
>
> • Decommissioned vehicles remain in inventory for historical reporting
> but exit operational dashboards.
>
> • Administrators may include or exclude a vehicle from the active
> booking pool without affecting any historical record.

**Functional** **Requirements**

||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 15 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**09** **C2** **Pool** **Vehicle** **Booking** **&** **Allocation** **Outcome**

Employees can book a suitable vehicle from the appropriate pool in
minutes, with eligibility, buffer and policy enforced automatically and
waitlists handling peak demand.

**Business** **Rules**

> • Every booking carries a buffer period — default 10 to 15 minutes,
> configurable — between consecutive bookings on the same vehicle, to
> allow inspection, cleaning, refuelling and handover.
>
> • Maximum booking duration is configurable by vehicle category.
> Bookings exceeding the limit trigger escalation.
>
> • Driver eligibility (employment status, driving licence validity) is
> validated before booking confirmation. Ineligible drivers are blocked.
>
> • Vehicles in any non-bookable status (Under Maintenance, Off-Hire
> Pending, Decommissioned, Quarantined, Temporary Hold) are excluded
> from search results.
>
> • Where demand exceeds supply, employees may join a waitlist;
> cancellations trigger automatic allocation to the next eligible
> waitlister.

**Functional** **Requirements**

||
||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 16 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 17 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**10** **C3** **Dedicated** **Vehicle** **Requests** **&**
**Entitlements**

**Net-new** **module** **versus** **v1.0.** Replaces the email-driven
entitlement process with a structured workflow, eligibility engine and
approval chain up to Cluster CEO.

**Outcome**

Every dedicated vehicle allocation — long-term or temporary, with-driver
or without-driver — runs through a structured workflow with eligibility
validation, formal justification, configurable approval up to Cluster
CEO, and periodic utilisation review.

**Business** **Rules**

> • Eligibility for a dedicated vehicle is a function of employee grade,
> role, cluster and approved policy limits. The platform shall evaluate
> this automatically before a request is submitted for approval.
>
> • Every request carries a mandatory business justification — selected
> from a configurable category list and supported by a free-text
> explanation.
>
> • Approval hierarchy is configurable and culminates at Cluster CEO for
> dedicated allocations above policy thresholds.
>
> • Dedicated vehicles shall be returned to the shared pool (BSD) during
> periods such as annual leave, sabbatical or extended business travel.
>
> • All allocations are subject to formal digital consent in line with
> Chapter 26.

**Functional** **Requirements**

||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 18 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

||
||
||
||
||
||

Internal — AD Ports Group Page 19 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**11** **C4** **Handover,** **Return** **&** **Damage** **Capture**
**Outcome**

Vehicle condition, fuel level and odometer are captured cleanly at
handover and return; damages are recorded in-app with photographic
evidence and signed acknowledgement.

**Functional** **Requirements**

||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 20 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**12** **C5** **Replacement** **Vehicles** **&** **Substitute**
**Drivers**

**Net-new** **module** **versus** **v1.0.**

**Outcome**

Booking continuity is preserved when a vehicle goes off-road or a driver
is temporarily replaced, with a complete audit chain that connects the
original record to the substitute.

**Business** **Rules**

> • A replacement vehicle may be assigned to an existing booking during
> maintenance or off-hire of the originally assigned vehicle. The
> booking reference remains stable.
>
> • A substitute driver may be authorised to operate a vehicle on behalf
> of the assigned driver for a defined period. Fines, accidents, tolls
> and trip records shall be temporarily attributed to the substitute for
> the duration.
>
> • Outside any authorised substitution, all fines, accidents, tolls and
> trip-related records default to the assigned driver.

**Functional** **Requirements**

||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 21 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**13** **C6** **Driver** **Eligibility,** **Compliance** **&**
**Documents**

**Outcome**

Only eligible drivers operate group vehicles, and only on vehicles that
are documentation-current. Expiries surface ahead of time; lapses block
bookings automatically.

**Functional** **Requirements**

||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 22 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**14** **C7** **Fines,** **Black** **Points** **&** **Accidents**
**Outcome**

Every fine, every accident and every black point is traceable to a
specific driver, vehicle and booking, with disciplinary triggers
configured and the black-points transfer cycle enforced.

**Business** **Rules**

> • Where a booking is active, the fine attaches to that booking and
> therefore to the driver.
>
> • Where no booking is active (e.g. dedicated executive vehicle outside
> the booking flow), the fine attaches to the assigned driver.
>
> • Where a substitute driver was authorised at the time of the fine,
> attribution follows the substitution window.
>
> • Drivers are responsible for transferring black points from the
> company vehicle to their personal traffic file within a defined
> timeframe. Until the transfer is complete, the driver is blocked from
> using, booking or accessing any company vehicle services.

**Functional** **Requirements**

||
||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 23 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

||
||
||
||
||

Internal — AD Ports Group Page 24 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**15** **C8** **Telematics,** **Live** **Tracking** **&** **Route**
**Replay** **Outcome**

Where a vehicle has telematics, the platform sees live location, ingests
trip data automatically, and supports historical replay for
investigations. Where it does not, the absence is recorded explicitly,
not assumed.

**Business** **Rules**

> • GPS tracker fields are optional. Some vehicles — particularly
> executive or leased — may not carry a tracker.
>
> • GPS status is recorded explicitly with values: Installed, Not
> Installed, Online, Offline, Faulty, Under Replacement.
>
> • Live location is visible only to operational roles (Fleet Manager,
> Cluster Fleet Lead, Group Fleet Lead) and is subject to data privacy
> controls under PDPL.
>
> • Historical route replay supports trip validation, fines
> investigation and operational reviews; access is logged.

**Functional** **Requirements**

||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 25 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**16** **C9** **Fuel** **&** **Cost** **Capture** **Outcome**

Per-vehicle fuel spend is calculated and reconciled against actual
consumption; variance is surfaced for fleet manager review.

**Functional** **Requirements**

||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 26 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**17** **C10** **Behaviour** **Scoring** **&** **Misuse** **Detection**
**Net-new** **module** **versus** **v1.0.**

**Outcome**

Booking misuse — repeated no-shows, late returns, early returns that
lock capacity out of the pool, overbooking and underutilisation — is
detected systematically, scored and escalated to HR when patterns
persist.

**Business** **Rules**

> • Behaviour signals include: no-show on a booking, late return
> relative to scheduled return, early return of pooled vehicles (e.g.
> 1–2 hours before booking end) that wastes pool capacity, overbooking
> patterns, and chronic underutilisation.
>
> • A configurable scoring mechanism aggregates signals across a rolling
> window.
>
> • Threshold breaches are flagged and escalated to HR for potential
> disciplinary action under the existing fleet usage policy.

**Functional** **Requirements**

||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 27 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**18** **C11** **AI** **Optimisation** **&** **Right-Sizing**
**Outcome**

The platform surfaces concrete optimisation actions — vehicles to
transfer, vehicles to off-hire, pools to right-size — and predicts
maintenance risk before it becomes downtime.

**Functional** **Requirements**

||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 28 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**19** **C12** **ESG** **&** **Sustainability** **Net-new** **module**
**versus** **v1.0.**

**Outcome**

Fleet contribution to the group's sustainability picture is measured and
reported: fuel trends, estimated CO₂ emissions, and the share of EV /
hybrid utilisation.

**Functional** **Requirements**

||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 29 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**PART** **IV**

**PLATFORM** **FOUNDATIONS**

**20** **Vehicle** **Inventory** **Data** **Model**

The fields below form the authoritative inventory schema. Every field is
required at vehicle onboarding unless marked optional. These fields
extend the data model proposed in v1.0 to reflect the cluster hierarchy,
expanded operational statuses, replacement workflows and entitlement
governance.

**20.1** **Identity** **&** **Classification**

||
||
||
||
||
||
||
||
||
||
||
||
||
||
||

**20.2** **Ownership** **&** **Commercial**

||
||
||
||

Internal — AD Ports Group Page 30 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

||
||
||
||
||
||
||
||
||
||
||
||
||
||

**20.3** **Compliance** **&** **Documents**

||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 31 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

||
||
||
||

**20.4** **Operational** **State** **&** **Hierarchy**

||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||

**20.5** **Telematics**

||
||
||
||
||

Internal — AD Ports Group Page 32 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

||
||
||
||
||
||

**20.6** **Risk** **Counters** **&** **Audit**

||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 33 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**21** **Integrations** **Map**

||
||
||
||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 34 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**22** **Reporting** **&** **Analytics** **22.1** **Operational**
**Reports**

> • Vehicle utilisation rate (% bookable hours used) — by vehicle,
> location, pool, cluster, period.
>
> • Cost per kilometre — fuel, maintenance, lease / depreciation, total
> — by vehicle, category, pool, cluster.
>
> • Demand vs capacity — peak demand windows vs available fleet,
> highlighting over- and under-provisioning per pool.
>
> • Accident trend — by vehicle, by driver, by pool, by month —
> including severity and cost.
>
> • Fines per user / per vehicle — top offenders, threshold breaches,
> pending black-point transfers. • Fuel consumption — expected vs actual
> deviation per booking and per vehicle.
>
> • Compliance status — vehicles approaching Mulkiya, insurance, lease
> expiry.
>
> • Vendor performance — leasing vendors compared on cost, service,
> off-road days, repair turnaround.
>
> • Dedicated vehicle utilisation and justification — per allocation,
> per cluster.
>
> • Behaviour score and misuse pattern report — per cluster, with HR
> escalation triggers.

**22.2** **Executive** **Dashboard**

> • Group utilisation %, cost per km, accident rate, demand vs capacity,
> ESG snapshot — by cluster. • Top 5 underutilised and overutilised
> vehicles.
>
> • Compliance heat map across clusters.
>
> • Dedicated-vehicle entitlement inventory with periodic review status.
> • Drill-down from group → cluster → pool → location → vehicle.

**22.3** **AI** **Intelligence** **Outputs**

> • Right-sizing recommendations — vehicles to transfer, off-hire,
> consolidate. • Lease reduction opportunities — surface candidates and
> the financial case. • Predictive maintenance flags — vehicles at
> elevated risk of breakdown.
>
> • Vendor outliers — repair vendors with above-peer turnaround or
> repeat failures.

Internal — AD Ports Group Page 35 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**23** **Alerts** **&** **Notifications**

||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 36 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**24** **Audit,** **Overrides** **&** **Exception** **Management**
**Net-new** **chapter** **versus** **v1.0.**

**Outcome**

Every override, every reassignment, every exception is captured,
attributed and reviewable. Internal Audit can reconstruct any
operational decision after the fact.

**Functional** **Requirements**

||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 37 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**PART** **V**

**NON-FUNCTIONAL** **&** **GOVERNANCE**

**25** **Non-Functional** **Requirements** **25.1** **Performance**

> • Booking search response \< 2 seconds for 95% of queries at peak
> load. • Dashboard load \< 4 seconds on first paint.
>
> • Telematics ingestion latency \< 30 seconds end-to-end. • Route
> replay rendering \< 5 seconds for a 4-hour trip.

**25.2** **Scalability**

> • Designed for 300+ vehicles initially, scaling to 5,000+ across
> global entities. • Multi-cluster, multi-pool, multi-tenant logical
> separation.
>
> • Multi-currency, multi-time-zone, multi-language (English primary,
> Arabic RTL at minimum).

**25.3** **Availability**

> • 99.5% availability during business hours; 99.0% overall (excluding
> planned maintenance). • RPO ≤ 1 hour, RTO ≤ 4 hours.

**25.4** **Security**

> • SSO via Microsoft Entra; MFA required for elevated roles.
>
> • Role-based access control with field-level masking for cost data.
>
> • All data in transit encrypted (TLS 1.2+); all data at rest encrypted
> (AES-256). • Full audit trail of every record change.
>
> • Data classification per AD Ports Group Data Hosting and Residency
> Policy.

**25.5** **Usability**

> • Desktop-first responsive web in Phase 1; native mobile app in Phase
> 2. • Accessibility — WCAG 2.1 AA compliance.
>
> • AD Ports Group brand-compliant UI.

**25.6** **Auditability**

> • Every booking, consent, entitlement, fine, accident, transfer,
> replacement and decommissioning event is immutably logged.
>
> • Internal Audit shall have read-only access to a complete audit log.

Internal — AD Ports Group Page 38 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**26** **Compliance,** **Privacy** **&** **Security**

> • UAE Information Assurance Regulation V2 — applicable to data
> classification and security controls.
>
> • UAE Personal Data Protection Law (PDPL) — applicable to employee
> personal data and driver / location data.
>
> • AD Ports Group Data Hosting and Residency Policy — primary residency
> UAE; cross-border transfers governed by tier model.
>
> • Driver location data is treated as sensitive personal data; access
> is logged and limited to operational roles with explicit purpose.
>
> • Digital signature on consent shall meet UAE Electronic Transactions
> and Trust Services Law standards.
>
> • Insurance and police data shall be retained per group records
> retention policy.

**Digital** **Consent** **—** **Hard** **Requirement**

> **DIGITAL** **CONSENT** **IS** **NON-NEGOTIABLE**
>
> Every booking and every dedicated vehicle allocation is subject to
> mandatory digital consent. The booking or allocation is not confirmed,
> and no booking number is issued, until consent is captured. Consent
> covers acceptance of responsibility for traffic fines incurred during
> the booking, acceptance of responsibility for damages, and commitment
> to comply with company vehicle usage policy and UAE traffic law.
> Consent records are stored immutably with employee ID, timestamp, IP,
> device and policy version, and are linked to the booking or
> entitlement record.

Internal — AD Ports Group Page 39 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**27** **Success** **Metrics** **&** **KPIs**

||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 40 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**PART** **VI**

**DELIVERY**

**28** **Phasing** **&** **Roadmap** **28.1** **Phase** **1** **—**
**Foundation** **(MVP)**

> • Vehicle inventory master (full Chapter 20 data model) including
> cluster, pool and operational status set.
>
> • Web booking with approval workflow, buffer enforcement, waitlist,
> smart recommendations, digital consent.
>
> • Dedicated vehicle request workflow with eligibility validation and
> Cluster CEO approval. • Handover / return flows with digital signature
> capture.
>
> • Compliance documents and expiry alerts; driver eligibility
> validation.
>
> • Manual fines and accidents register, with booking / driver linkage;
> black-points workflow.
>
> • Operational dashboards (utilisation, fines per user, compliance heat
> map, entitlement inventory). • Oracle HCM integration (employee +
> hierarchy + leave for BSD return).
>
> • Audit log and segregation of duties enforcement.
>
> • Pilot at GS Pool (Mina Zayed), replacing Vehicle Allocation in
> Mehwar.

**28.2** **Phase** **2** **—** **Scale** **&** **Automate**

> • Group-wide rollout across UAE entities and clusters.
>
> • GPS / telematics integration with live location, odometer and route
> replay. • Mobile damage capture during handover and return.
>
> • OCR / NLP fuel invoice ingestion.
>
> • Mobile app (iOS + Android) for booking and handover. • Push
> notifications and SMS for critical alerts.
>
> • Salik / Darb integration where APIs available.
>
> • Maintenance scheduling automation and downtime metrics. •
> Replacement vehicle and substitute driver workflows.
>
> • Behaviour scoring engine with HR escalation.

**28.3** **Phase** **3** **—** **Intelligence** **&** **International**

> • AI optimisation layer — utilisation, anomaly, cost outlier,
> predictive maintenance, driver risk. • Right-sizing and
> lease-reduction recommendations in the executive dashboard.
>
> • ESG reporting at group and cluster level.
>
> • International rollout (multi-currency, multi-language,
> multi-region).
>
> • Direct fines feed integration with UAE traffic authorities (subject
> to API access). • Integration into group BI / analytics platform for
> executive and ESG reporting.

Internal — AD Ports Group Page 41 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**29** **Risks,** **Assumptions,** **Dependencies** **29.1** **Risks**

||
||
||
||
||
||
||
||
||
||
||
||
||

**29.2** **Assumptions**

> • Oracle Fusion HCM is the authoritative employee master and is
> integration-ready. • Microsoft Entra is the authoritative identity
> provider for SSO.
>
> • Group has authority to mandate the platform across clusters and
> entities.
>
> • Clusters will provide a data steward to support inventory migration
> and ongoing data quality. • Annual vehicle inspection is bundled with
> Mulkiya renewal — no separate field required.

Internal — AD Ports Group Page 42 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

> • Cluster CEOs are willing to be in the entitlement approval chain for
> thresholds defined by policy.

**29.3** **Dependencies**

> • Procurement to confirm GPS / telematics vendor terms before Phase 2.
>
> • Group Cybersecurity to approve data classification and integration
> patterns.
>
> • Group Finance to confirm depreciation rate configuration and Oracle
> AP integration scope.
>
> • Group HR to define disciplinary workflow triggered by fines
> threshold and behaviour score breach. • Group Legal to approve consent
> wording per UAE Electronic Transactions and Trust Services Law. •
> Group Sustainability to provide CO₂ emission factors per fuel type.

Internal — AD Ports Group Page 43 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**30** **Open** **Decisions**

||
||
||
||
||
||
||
||
||
||
||
||
||
||

Internal — AD Ports Group Page 44 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**31** **User** **Journeys**

**31.1** **Journey** **A** **—** **Employee** **books** **a** **pool**
**car**

> 1\. Employee logs into the portal via SSO.
>
> 2\. Selects “New Booking” and enters pick-up date / time, return date
> / time, destination, purpose, passenger count.
>
> 3\. System filters available vehicles by window, capacity, status,
> pool scope and buffer; runs eligibility check on the employee.
>
> 4\. Employee selects a recommended vehicle; system computes expected
> fuel and shows summary. 5. Employee signs the digital consent form;
> without consent, the booking cannot proceed.
>
> 6\. System routes for approval to the line manager.
>
> 7\. Approver approves; employee receives booking number and
> confirmation. 8. Reminders sent 24 hours before pick-up and 1 hour
> before return.
>
> 9\. Employee collects vehicle from fleet manager; signs handover
> digitally.
>
> 10.On return, fleet manager records ending mileage and condition;
> system reconciles fuel and time.

**31.2** **Journey** **B** **—** **Demand** **spike,** **pool**
**full,** **employee** **uses** **waitlist** 11.Employee searches for a
vehicle for the next morning; no vehicle is available. 12.System offers
to add the employee to the waitlist; employee accepts.

> 13.Another booking is cancelled overnight; system auto-allocates the
> cancelled vehicle to the next eligible waitlister.
>
> 14.Employee receives notification with the booking number and reminder
> to sign consent.

**31.3** **Journey** **C** **—** **Director** **requests** **a**
**dedicated** **vehicle**

> 15.Director opens “Dedicated Vehicle Request” in the portal.
>
> 16.System evaluates eligibility against grade, role, cluster and
> policy; presents eligible vehicle options.
>
> 17.Director selects category — long-term, with-driver — and enters
> duration, start / end dates, operational location, business unit, cost
> centre and remarks.
>
> 18.Director selects business justification (e.g. project support) and
> adds free-text explanation; attaches the project memo.
>
> 19.Request routes through Line Manager → Cluster Fleet Lead → Cluster
> CEO. 20.On final approval, system requires the assigned driver's
> digital consent.
>
> 21.System notifies fleet manager to prepare the vehicle and configures
> BSD return for known leave windows.

**31.4** **Journey** **D** **—** **Fine** **arrives** **10** **days**
**after** **a** **trip**

> 22.Authority issues a fine with vehicle plate, date, time, location.
>
> 23.Fleet manager records the fine (or system ingests it via API in
> Phase 2).
>
> 24.System auto-matches the booking active at that date / time / plate;
> respects any substitute-driver window.
>
> 25.System logs the fine against vehicle and driver; if it is the
> driver's third fine in the rolling window, alert goes to HR and line
> manager.

Internal — AD Ports Group Page 45 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

> 26.System notifies the driver of any black points and the transfer
> deadline.
>
> 27.Until the transfer is confirmed, the driver is blocked from
> booking, using or accessing any company vehicle services.

**31.5** **Journey** **E** **—** **Vehicle** **goes** **off-road,**
**replacement** **issued**

> 28.Fleet manager moves the vehicle to Under Maintenance after a failed
> inspection.
>
> 29.System surfaces the affected booking and recommends an eligible
> replacement from the same pool.
>
> 30.Fleet manager assigns the replacement; system links original
> vehicle, replacement vehicle, booking and driver in the audit chain.
>
> 31.Employee receives notification with the replacement vehicle
> details; the booking number is unchanged.
>
> 32.On return, downtime is logged against the original vehicle and
> contributes to vendor turnaround metrics.

**31.6** **Journey** **F** **—** **Executive** **opens** **the**
**dashboard**

> 33.GCEO / GCDIO opens the executive dashboard: group utilisation, cost
> per km, fleet status, top under / overutilised vehicles, accident
> trend, compliance heat map, ESG snapshot, dedicated-vehicle inventory.
>
> 34.Drills from group to cluster to pool to vehicle in two clicks.
>
> 35.AI panel surfaces three vehicles with significant underutilisation
> and recommends transfer or off-hire, with the financial case.

Internal — AD Ports Group Page 46 of 47

**AD** **PORTS** **GROUP** / Fleet Management Platform — PRD
v2.0

**32** **Glossary**

||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||
||

> **END** **OF** **DOCUMENT**
>
> AD Ports Group / Enabling Global Trade

Internal — AD Ports Group Page 47 of 47
