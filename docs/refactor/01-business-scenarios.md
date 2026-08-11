# Business Scenarios & Blocking Matrix

Exhaustive, reality-based scenario catalog that the enhancement must cover. Each scenario has a stable ID (`S-xx`) referenced by the phase files. "Expected" describes the target behaviour after the program; "Today" notes the current gap.

---

## 1. Personas

| Persona | Role(s) | Primary needs |
|---|---|---|
| **Employee** | Employee | Book a pool vehicle; request a dedicated vehicle; see own eligibility/credentials/bookings; fix missing details |
| **Professional Driver** | ProfessionalDriver | Be onboarded/assigned; drive dedicated/with-driver requests; keep licence/medical current |
| **Substitute Driver** | SubstituteDriver | Temporarily drive; provide own licence |
| **Line Manager / Approver** | Approver, Delegate | Approve/decline booking & dedicated requests |
| **Fleet Manager** | FleetManager | Handover/return, allocation, driver assignment, vehicle master |
| **Cluster/Group Fleet Lead** | ClusterFleetLead, GroupFleetLead | Scoped oversight, approvals |
| **Cluster CEO** | ClusterCEO | Final dedicated approval |
| **Data Steward** | DataSteward | Verify manually-entered credentials/documents; reference data |
| **System Admin** | SystemAdmin | Users/roles, policy, HCM config, help content |
| **HSE / Internal Audit** | HSE, InternalAudit | Blocks, evidence, audit |

---

## 2. Credential & document scenarios

| ID | Scenario | Expected | Today |
|---|---|---|---|
| S-01 | HCM connected, licence present & fresh | Auto-fetched; gate uses HCM value; UI shows source=HCM | Sync never runs |
| S-02 | HCM connected, licence field missing | Prompt manual capture; store as manual/Unverified; merge without overwriting HCM-owned fields | No prompt, no merge |
| S-03 | HCM **not** connected at all | Manual entry always available; verified manual data trusted by gate | No manual surface |
| S-04 | First-time booking, licence missing | Block (`licence-missing`), inline capture (number+expiry+file), re-evaluate, proceed | Not blocked (fail-open); no capture |
| S-05 | Second booking, licence present | Auto-fill from profile; no re-entry | `/me` lacks fields → cannot prefill |
| S-06 | Licence expired | Block (`licence-expired`); force refill; re-evaluate | Generic block; no refill flow |
| S-07 | Licence expiring in ≤30 days | Warn (non-blocking banner + notification); allow booking | No warning |
| S-08 | Emirates ID missing/expired | Configurable: warn or block per policy; capture inline | No EID field at all |
| S-09 | Manual value vs later HCM value diverge | Deterministic precedence (HCM authoritative when fresh); keep both; flag for Steward; audit | Undefined; silent overwrite risk |
| S-10 | Self-entered data pending verification | `Unverified` badge; still hard-blocks on expiry; Steward can verify | Not modeled |
| S-11 | Data stale (>freshness SLA) with HCM off | Trust verified manual; do **not** block on staleness | Hard block `hcm-data-stale` |
| S-12 | Document uploaded once | Reused across booking, dedicated, driver, profile, admin | No doc store |
| S-13 | Document replaced (new licence) | New version; old retained; expiry recalculated; provenance updated | N/A |
| S-14 | PII access | Only authorized roles view licence/EID/files; excluded from safe projections/logs | Partially (reads avoid PII, but no store) |

---

## 3. Booking (pool) scenarios

| ID | Scenario | Expected | Today |
|---|---|---|---|
| S-20 | Happy path ≤4h | Draft → consent (gate) → PendingApproval → LineManager approve → Approved → handover → Active → return → Completed | Works when data fresh |
| S-21 | Duration ≥24h | Adds FleetManager approval step | Works |
| S-22 | Vehicle capacity < passengers | Block with `booking-vehicle-capacity-insufficient`; suggest larger vehicle | Count-only validation |
| S-23 | Multiple passengers | Capture passenger identities (employee pick or guest); validate count | Count only |
| S-24 | Consent template changed mid-flow | Re-consent prompt (specific message) | Handled (silent refetch) |
| S-25 | Concurrent booking / double-book | Exclusion constraint blocks; clear message | Constraint exists; message generic |
| S-26 | Driver ≠ requester (on behalf) | On-behalf capture; driver must be eligible | Supported (requester only) |
| S-27 | Vehicle docs expired (mulkiya/insurance) | Block with specific reason; not the driver's fault → guidance to Fleet | Reason swallowed |
| S-28 | Active access block on driver | Block `access-blocked:<reason>`; show reason + who to contact | Reason swallowed |
| S-29 | Employment inactive | Block `employment-inactive` | Reason swallowed |
| S-30 | Modify vehicle/window after consent | Re-consent; re-evaluate gate | Supported |
| S-31 | Extend active booking | Allowed with revision guard | Supported |
| S-32 | No-show / expiry | Auto transitions; visible in profile | Partially |
| S-33 | Cancel | Releases reservation | Supported |

---

## 4. Dedicated vehicle scenarios

| ID | Scenario | Expected | Today |
|---|---|---|---|
| S-40 | Eligible (WithoutDriver, Temporary, matching justification, ≤90d) | ALLOW; save; submit; approval chain; consent; allocate | Works |
| S-41 | Ineligible combo (e.g. LongTerm + Temporary-only justification) | Show **exact** reason (justification/request-type mismatch) | Fixed (message added) — extend coverage |
| S-42 | Grade not eligible for LongTerm | Explain grade rule + what qualifies | Generic |
| S-43 | WithDriver but no professional driver selected/available | Explain; link to driver register | Partial |
| S-44 | Permitted class has no available vehicle | Allow save without preference; explain | Empty list, unexplained |
| S-45 | Approval chain (Temporary) | LineManager → FleetManager → ClusterCEO | Works |
| S-46 | Driver consent (WithDriver) | Assigned driver signs; requester notified | Works |
| S-47 | Allocation, renewal, return | FleetManager allocates; renew/return lifecycle | Works |

---

## 5. Driver management scenarios

| ID | Scenario | Expected | Today |
|---|---|---|---|
| S-50 | Promote person to professional driver | Onboarding: capture licence, medical, training, endorsements; set flag | Flag only, no UI |
| S-51 | Assign driver to vehicle (Dedicated model) | Assignment with effective dates; exclusivity; history | Vehicle drawer sets id only |
| S-52 | Driver licence/medical expiring | Warn + block driving assignments on expiry | No lifecycle |
| S-53 | Substitute driver temporary use | Capture own licence; time-bounded | Not modeled |
| S-54 | Driver register/directory | Searchable professional-driver register with credential status | Only `listProfessionalDrivers` internal |
| S-55 | Remove/replace assigned driver | Enforce Dedicated-requires-driver invariant; audit | Invariant exists (update) |

---

## 6. Blocking-reason matrix (must all be specific + actionable, EN/AR)

| Reason code | Origin | User message (intent) | Remediation |
|---|---|---|---|
| `hcm-data-stale` | freshness gate | "Your profile hasn't synced recently." | Auto-refresh / trust manual / contact HR |
| `licence-missing` (new) | hardBlock | "No driving licence on file." | Inline capture |
| `licence-expired` | hardBlock | "Your driving licence has expired." | Inline refill |
| `emirates-id-missing/expired` (new) | hardBlock/policy | "Emirates ID required/expired." | Inline capture |
| `hard-block-registration-expired` | hardBlock | "Vehicle registration expired." | Choose another / Fleet |
| `hard-block-insurance-expired` | hardBlock | "Vehicle insurance expired." | Choose another / Fleet |
| `access-blocked:<reason>` | block table | "Your access is blocked: <reason>." | Contact HSE/Admin |
| `employment-inactive` | hardBlock | "Your employment status is not active." | Contact HR |
| `booking-vehicle-not-bookable` | hardBlock | "Vehicle unavailable for booking." | Choose another |
| `booking-vehicle-capacity-insufficient` | rule | "Not enough seats for N passengers." | Choose larger |
| `entitlement-justification-request-type-not-allowed` | dedicated | "Category not allowed for this duration." | Change category/duration |
| `dedicated-manual-policy-no-match` | dedicated | "Not eligible under current policy." | Show qualifying criteria |
| `booking-consent-version-changed` | consent | "Consent updated — review & re-agree." | Re-consent |

---

## 7. Profile / self-service scenarios

| ID | Scenario | Expected |
|---|---|---|
| S-60 | See my eligibility status | Live eligibility summary (what would block me now) |
| S-61 | See/fix my credentials | Licence/EID number, expiry, source, verification; upload/replace |
| S-62 | See my documents | All my documents in one place |
| S-63 | See my bookings | Active/upcoming/past + statuses |
| S-64 | See my approvals/rejections | Requests I raised + decisions + reasons |
| S-65 | See my issues/blocks | Current blockers with remediation links |
| S-66 | Notifications | Expiry reminders, approval outcomes |

---

## 8. Help center scenarios

| ID | Scenario | Expected |
|---|---|---|
| S-70 | Dedicated help center | Browsable FAQ + guides by topic (booking, dedicated, credentials, handover) |
| S-71 | Contextual help | "?" affordances linking to relevant help from each screen/block |
| S-72 | Reason-linked help | Each block reason links to a "why & how to fix" article |
| S-73 | Bilingual help | EN/AR content |
| S-74 | Admin-authored content | Steward/Admin edits FAQ without deploy |

---

## 9. HCM / sync scenarios

| ID | Scenario | Expected |
|---|---|---|
| S-80 | HCM enabled | Scheduled sync + admin trigger; last-sync visible; health signal |
| S-81 | HCM disabled | App fully functional on manual data |
| S-82 | Sync partial failure | Per-record errors surfaced; no silent data loss |
| S-83 | Precedence | HCM authoritative when fresh; manual fallback; verified manual never silently overwritten |
| S-84 | Sync staleness alert | Alert when last successful sync exceeds SLA |

---

## 10. Driver accountability — fines, black points, blocks, consent (developer review; see phase-9)

| ID | Scenario | Expected |
|---|---|---|
| S-90 | Attributed fine/toll | Driver sees it (amount, date, vehicle, status) + recovery path |
| S-91 | Dispute a fine | Raise dispute (reason/evidence) → `Disputed`; Fleet adjudicates |
| S-92 | Black points overdue | See balance + consequences; overdue **auto-raises** an access block (existing logic) |
| S-93 | Access-blocked driver | Profile shows **why** (linked fine/black-point/HSE reason) + who to contact; bookings blocked |
| S-94 | Block lifted | HSE/Steward lifts with reason; eligibility restored; audited; **self-lift forbidden (SoD)** |
| S-95 | Damage at return | Return handover damage → fine/recovery; visible to driver |
| S-96 | Consent history | "My consents" shows signed versions + times |
| S-97 | Re-consent | Consent version changed → review & re-agree; old version retained (immutable) |
| S-98 | Dedicated WithDriver consent | Assigned driver signs; requester notified; visible to both |
| S-99 | Consent withdrawal/expiry | Where policy allows, withdrawal blocks future use; audited |

## 11. Vehicle & vendor compliance (symmetry with driver credentials)

| ID | Scenario | Expected |
|---|---|---|
| S-100 | Vehicle Mulkiya/insurance expiring | Alert Fleet; block bookings on expiry (`hard-block-*`); renewal via vehicle document vault |
| S-101 | Vendor/lease health hold | `vendorHealthHold` blocks affected vehicles; reason surfaced |
| S-102 | Vehicle not bookable / off-hire | Clear reason; choose another vehicle |

## 12. Delegation & on-behalf / substitute driver

| ID | Scenario | Expected |
|---|---|---|
| S-110 | Approver out-of-office | Delegate receives approvals; delegation window + audit (existing DelegationModule) |
| S-111 | Book on behalf of employee | Fleet books; the **driver** (not the logged-in user) must be eligible; capture that driver's licence if missing |
| S-112 | Substitute driver drives | Capture substitute's own licence (time-bounded); eligibility applies to the substitute |

## 13. Bulk onboarding & admin

| ID | Scenario | Expected |
|---|---|---|
| S-120 | Bulk import people/drivers/credentials | Steward imports via MigrationModule; validation + error report; audited |
| S-121 | Reference data for doc/credential types | New document/credential types configured via reference-data (lookups) |

## 14. Oversight & dashboards

| ID | Scenario | Expected |
|---|---|---|
| S-130 | Credential/vehicle expiry dashboard | Fleet sees upcoming expiries (drivers + vehicles) to act proactively |
| S-131 | Block-reason analytics | Frequency of block reasons to fix root causes |
| S-132 | Sync/compliance health | HCM sync health + compliance posture at a glance |

## 15. Feature management & forced document requests (developer addition)

| ID | Scenario | Expected |
|---|---|---|
| S-140 | Admin toggles a feature | Admin Settings UI enables/disables features per org at runtime (e.g. self-service credentials); effect is immediate |
| S-141 | Self-service disabled | Employees cannot self-upload; only admin/steward can enter credentials |
| S-142 | Force a specific employee to upload | Admin raises a document request for an employee (doc type + reason + due date); employee sees a task; status tracked to fulfilment |
| S-143 | Notify on request/expiry | The employee receives an **email + in-app notification** for the request and for approaching expiry (compliance category = unmutable) |
