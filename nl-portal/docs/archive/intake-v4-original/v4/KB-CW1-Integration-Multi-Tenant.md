# KB Note — CargoWise Integration with Multi-Tenancy

| | |
|---|---|
| **Topic** | How a message from CargoWise One (CW1) is assigned to the right customer, and how portal actions carry the right customer back to CW1 |
| **Related PRD items** | §5 integration architecture · §6 CustomerGroup / CustomerAccount · §7 security (RLS everywhere) · FG-1.1 / FG-1.5 / FG-1.6 visibility rules · FG-3.1 / FG-3.2 "all CW1-created quotes and bookings visible" · FG-8.1 org-code grouping |
| **Written** | 03.09.2026 |
| **Status** | Design — adopted in 01-Plan v2, CLAUDE.md v2 and LLD v2. **v2 notes**: `shipment_visibility` is a current-state table (no `revoked_at`; history in audit); visibility policy is global for now (per-group override deferred, gaps.md #4); the 4-eyes approval in §3 rule 5 is a proposal pending sign-off (ADR-003) |
| **Audience** | Developers new to freight forwarding — plain English |

---

## 1. The problem in one sentence

CargoWise does not know our customer groups. Every inbound message identifies parties only by **CW1 organisation codes**. If we map an org code to the wrong customer group, one customer sees another customer's cargo. This is the single highest-risk point in the platform, so it needs its own design.

## 2. Vocabulary

| Term | Meaning |
|---|---|
| **CW1 organisation (org code)** | A company record in CargoWise, e.g. `ACMEUK001`. A shipment references several: shipper, consignee, notify party, local client, agent |
| **Local client** | The org code CW1 invoices for the job. Usually — not always — the party we consider "the customer" |
| **CustomerAccount** | Our record for one CW1 org code (+ branch, country). Belongs to exactly one CustomerGroup |
| **CustomerGroup** | Our tenant. One customer company, possibly with parent/child hierarchy |
| **Tenant resolution** | The step that turns the org codes on a message into zero, one or many `customer_group_id`s |
| **Visibility link** | A row saying "group X may see shipment Y in role Z" |

## 3. Design rules

1. **A shipment can be visible to more than one customer group.** Visibility is a link table, not a column on `shipment`.
2. **Every CW1 entity is stored, whether or not it maps to a customer.** CW1 is the truth; a customer onboarded later must see their history. Unmapped rows have zero visibility links and appear in an ops "unmapped" queue.
3. **Only the worker resolves tenants, and only from the mapping table.** Never from anything a user typed, never from a reference number, never from an email domain.
4. **Outbound messages carry an org code chosen server-side** from the accounts in the user's group. The client never sends an org code.
5. **Changing the mapping is a privileged, audited, 4-eyes action.** Every change triggers re-evaluation of visibility for affected entities.
6. **Internal Noatum users bypass group filters but not content flags** (`internal_only` events/documents, financial restrictions still apply as per PRD FG-1.3).
7. **The worker runs in a system tenant context** that can write with an explicit `customer_group_id` from resolution, and cannot be reached from any HTTP request.

## 4. Tenant resolution — step by step

```
inbound UniversalShipment / UniversalEvent / UniversalTransaction / eDoc
        │
        ▼
1. Parse parties → list of (role, org_code)
   roles: LocalClient, Shipper, Consignee, NotifyParty, Agent, Addressee (invoices)
        │
        ▼
2. For each org_code: look up customer_account WHERE cw1_org_code = code AND status = active
        │
        ▼
3. Build visibility set = distinct (customer_group_id, role) for matches
   Apply role policy: which roles grant visibility (default: LocalClient, Shipper, Consignee; NotifyParty configurable per group; Agent never)
        │
        ▼
4. Upsert canonical entity (shipment / event / invoice / document) in system context
        │
        ▼
5. Replace shipment_visibility rows for this shipment with the visibility set
   (events, documents, legs inherit visibility from their shipment)
        │
        ▼
6. If visibility set is empty → write to unmapped_entity queue with the org codes seen
        │
        ▼
7. Emit AuditEvent(kind = tenant_resolution, entity, groups, org_codes, message_id)
```

**Invoices are special.** A financial transaction is visible only to the group whose account is the **addressee** (PRD FG-1.6). Invoice visibility uses `addressee_org_code` alone, not the shipment's visibility set.

**Documents inherit shipment visibility**, then the `internal_only` type flag is applied on top.

**Quotes and bookings created in CW1 by staff** ("adoption", PRD FG-3.1 acceptance): resolve on the quote's LocalClient org code; if mapped, create the portal record with `source = cw1`; if not, store unmapped.

## 5. Tables

### 5.1 Existing tables — changes

| Table | Change |
|---|---|
| `customer_account` | add `status` (active / suspended), `mapping_approved_by`, `mapping_approved_at`; unique index on `cw1_org_code` (one org code → one group, always) |
| `shipment`, `consol`, `container_unit`, `transport_leg`, `milestone_event`, `document` | **remove** `customer_group_id` column; visibility comes from `shipment_visibility` |
| `financial_transaction` | keep `customer_group_id` (resolved from addressee org code) — single owner is correct here |
| `quote`, `booking` | keep `customer_group_id` (single owner) + `customer_account_id` (which org code was used) |

### 5.2 New tables

**shipment_visibility**

| Column | Notes |
|---|---|
| shipment_id | FK |
| customer_group_id | FK |
| role | LocalClient / Shipper / Consignee / NotifyParty |
| resolved_from_org_code | which code produced this row |
| resolved_at, message_id | provenance |
| PK (shipment_id, customer_group_id) | one row per group, roles as array or the highest-privilege role |

**org_role_policy** (per CustomerGroup, with a global default)

| Column | Notes |
|---|---|
| customer_group_id nullable | null = global default |
| role | LocalClient / Shipper / Consignee / NotifyParty / Agent |
| grants_visibility | bool |

**unmapped_entity**

| Column | Notes |
|---|---|
| entity_type, entity_id | shipment / quote / booking / invoice |
| org_codes_seen | jsonb array of (role, code) |
| first_seen_at, last_seen_at, occurrence_count | |
| status | open / mapped / ignored |
| resolved_by, resolved_at | |

**mapping_change_request** (4-eyes for org-code mapping)

| Column | Notes |
|---|---|
| kind | add_account / move_account / suspend_account |
| cw1_org_code, from_group_id, to_group_id | |
| requested_by, requested_at, approved_by, approved_at, status | approver ≠ requester enforced |
| re_evaluation_job_id | job that re-resolves affected entities after approval |

### 5.3 RLS policy shape

For multi-visibility tables the policy is an EXISTS on the link table:

```sql
CREATE POLICY shipment_tenant ON shipment
  USING (
    current_setting('app.is_internal', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM shipment_visibility v
      WHERE v.shipment_id = shipment.id
        AND v.customer_group_id = current_setting('app.customer_group_id')::uuid
    )
  );
```

Child tables (`milestone_event`, `document`, `transport_leg`) join through `shipment_id` to the same rule. The API sets `app.customer_group_id` (and `app.is_internal`) per request from the logged-in user. The worker sets `app.is_system = true` and writes explicit `customer_group_id`s from resolution — no other role may set that setting.

**Hierarchy** (parent group sees child groups, PRD FG-8.1): resolve the user's group plus descendants at login into `app.customer_group_ids` (array) and use `= ANY(...)` in the policy.

## 6. Outbound direction (portal → CW1)

| Step | Rule |
|---|---|
| User starts a quote or booking | API loads the accounts of the user's group. If one → used automatically. If several → user picks from a dropdown of *names*; the API maps name → org code server-side |
| Message built in worker | `TmsQuoteAdapter` / `TmsBookingAdapter` set LocalClient org code from `customer_account.cw1_org_code`; portal ID goes in `AdditionalReference` |
| Reply from CW1 | matched first by `AdditionalReference` (portal ID); tenant re-checked against the mapping — if the reply's org code no longer maps to the same group, quarantine the message and alert ops instead of updating |

## 7. Internal Noatum users

- `app.is_internal = true` bypasses group filtering.
- Content flags still apply: `internal_only` events and documents are visible to internal users, but rows flagged `financial_restricted` are not unless the user has `finance.internal`.
- Impersonation (PRD FG-8.1) switches the session to the target user's group context — the impersonating admin sees exactly what the customer sees, nothing more, and every action is audited.

## 8. Public endpoints

Public T&T looks up a reference **without** any tenant context and returns only the critical-path milestones and office contact. It must never expose `shipment_visibility`, party names, or the number of matching groups. If a reference matches shipments under several groups, return the same minimal result set — do not disambiguate by customer (gap flagged in the plan).

## 9. Failure modes and how the design handles them

| Situation | Behaviour |
|---|---|
| Org code not mapped | Store entity, zero visibility, unmapped queue, ops alert |
| Same org code mapped to two groups | Impossible — unique index; migration script checks existing data |
| Org code moved from group A to group B | Change request → approval → re-evaluation job removes A's links and creates B's; audit trail |
| Customer sees a shipment they say is not theirs | Audit shows which org code and role granted visibility, and which message; fix mapping or role policy |
| CW1 sends the same shipment with different parties | Visibility set replaced on each message (rule 5 in §4); history kept in audit |
| Worker crashes mid-resolution | Message stays in queue; resolution is idempotent; visibility replace is one transaction with the upsert |

## 10. Tests that must exist

1. Shipment with LocalClient in group A and Consignee in group B → both see it, each in their own role; group C gets 404.
2. Shipment with only unmapped org codes → stored, no group sees it, unmapped queue row exists.
3. Invoice addressed to account A2 in group A → user of account A1 in the same group does **not** see it (addressee rule), user of A2 does.
4. Mapping change A → B approved → group A loses visibility of past shipments, B gains it, audit rows written.
5. Requester cannot approve their own mapping change.
6. Outbound quote from a group with two accounts carries the chosen account's org code; a tampered org code in the request body is ignored.
7. Reply from CW1 whose org code maps to a different group than the original quote → message quarantined, no update.
8. Parent group user sees child group shipments; child group user does not see parent's.
9. Public T&T for a reference matching two groups' shipments returns identical minimal output to a single-match case.
10. Worker cannot be reached by HTTP with the system tenant setting.

## 11. Changes to the slice plan

| Slice | Change |
|---|---|
| **S1.02 Tenancy + identity** | `customer_account` gets unique `cw1_org_code`, `status`, approval columns. Session sets `app.customer_group_ids` including descendants |
| **S1.07 Integration backbone** | rename to **"Integration backbone + tenant resolution"**. Add: `TenantResolver` service, `org_role_policy`, `unmapped_entity`, system tenant context for the worker, resolution audit events, tests 2 and 10 |
| **S1.09 Quote submit + CW1 round-trip** | account selection server-side; org-code-mismatch quarantine on reply; adoption of CW1-created quotes through the resolver; tests 6 and 7 |
| **S1.12 Admin** | org-code mapping via `mapping_change_request` with 4-eyes and re-evaluation job; unmapped queue screen; tests 4 and 5 |
| **S2.01 Shipment model + ingestion** | `shipment_visibility` instead of `customer_group_id`; RLS via EXISTS; documents/events inherit; tests 1 and 8 |
| **S2.03 Public T&T** | multi-group match behaviour; test 9 |
| **S2.05 Financial visibility** | resolution from addressee org code only; test 3 |
| **New slice S1.07b** (optional split) | Ops screens: unmapped queue, resolution audit viewer, replay after mapping fix |

## 12. Open points

| Item | Owner |
|---|---|
| Default role policy: does NotifyParty grant visibility by default? (PRD silent) | Product + Ops |
| Does a Noatum agent office (Agent role) ever count as a customer? Proposal: never | Ops |
| How CW1 identifies the LocalClient in UniversalShipment (depends on OQ-2 message configuration) | CW1 team |
| Retention of `shipment_visibility` history when mapping changes — **decided v2**: current-state table, history in `audit_event` | Tech lead |
