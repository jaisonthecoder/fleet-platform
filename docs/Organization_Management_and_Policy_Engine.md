# Organization Management & Policy Engine
## Complete Technical Reference — FleetOps Platform

**Version 1.0 · Database: PostgreSQL · Stack: NestJS + TypeScript + Drizzle ORM**

---

## 1. Overview — The Three Pillars of Reusability

This document covers how the FleetOps platform manages organizations, clusters, pools and locations, and how the policy engine connects to all of them. Three things together make the platform reusable across organizations without code changes:

```
Pillar 1 — Dormant schema seam     (ADR-008)
  └── organization_id on core tables, RLS off, inert
  └── Makes future multi-org a routine change, not a crisis

Pillar 2 — Configurable hierarchy  (FR-ARC-02)
  └── N-level tree: Cluster → Pool → Location
  └── Labels, depth and structure are configuration, not code

Pillar 3 — Policy engine           (FR-ARC-03)
  └── All business rules in decision tables
  └── Different org = different tables, same engine
```

---

## 2. AD Ports Organization Structure (from PRD §5)

### 2.1 The three hierarchy levels

```
LEVEL 0 — CLUSTER   (top-level business unit)
LEVEL 1 — POOL      (logical fleet grouping within a cluster)
LEVEL 2 — LOCATION  (physical site — yard, gate, building)
```

Each vehicle belongs to **exactly one cluster, one pool, and optionally one location** at any point in time. This is not a many-to-many relationship — it is a strict tree. Transfers are tracked with full history (from, to, date, approver, reason).

### 2.2 All clusters (Level 0)

| ID | Cluster Name | Code | Notes |
|---|---|---|---|
| 1 | Ports | PORTS | Manages the port operations fleet |
| 2 | Logistics | LOG | Kezad and logistics fleet |
| 3 | Maritime & Shipping | MAR | AD Maritime offices fleet |
| 4 | Economic Cities & Free Zones | ECFZ | To be confirmed by data steward |
| 5 | Digital | DIG | Shares buildings with other clusters — see §3 |
| 6 | Corporate | CORP | Includes Group Services (GS Pool) |

> **Note:** Clusters 4 and 5 do not have named pools in the PRD. Their pool structure must be confirmed by the cluster data steward during the Phase 1 data migration sprint (M3) before Phase 2 rollout.

### 2.3 All pools (Level 1) — named in the PRD

| Pool Name | Pool Code | Parent Cluster | Notes |
|---|---|---|---|
| Khalifa Port Pool | PORTS-KHALIFA | Ports | — |
| Zayed Port Pool | PORTS-ZAYED | Ports | Includes GS Pool pilot location |
| Kezad HQ Pool | LOG-KEZAD | Logistics | — |
| AD Maritime Pool | MAR-ADMAR | Maritime & Shipping | — |
| GS HQ Pool (Group Services) | CORP-GSHQ | Corporate | **Phase 1 pilot pool** |

> **Pool name uniqueness rule:** a pool name must be unique within its cluster but does NOT need to be globally unique. Two clusters can have a pool called "HQ Pool." The `code` field is the globally unique identifier used in reports, audit logs and API references (e.g. `PORTS-KHALIFA` vs `CORP-GSHQ`).

### 2.4 All locations / yards (Level 2) — named in the PRD

| Location Name | Parent Pool | Notes |
|---|---|---|
| Khalifa Port | Khalifa Port Pool | — |
| Khalifa Logistics City | Khalifa Port Pool | — |
| Mina Zayed — Yard A | Zayed Port Pool | **Phase 1 pilot start location** |
| Mina Zayed — Yard B | Zayed Port Pool | Same physical yard complex |
| Kezad HQ E11 | Kezad HQ Pool | — |
| Kezad 280 | Kezad HQ Pool | Separate site from E11 |
| Group HQ | GS HQ Pool | — |
| Maqta | GS HQ Pool | — |
| AD Maritime offices | AD Maritime Pool | — |
| Supporting sites | AD Maritime Pool | Multiple sub-sites |

> **Location address uniqueness:** locations are NOT required to be unique. The same physical building (e.g. "Khalifa Port Building A") can appear as a location under multiple pools from different clusters. The location is just a label on a vehicle record indicating where it is stationed — it does not imply pool ownership of the physical space. See §3 for the shared-building scenario.

### 2.5 The full AD Ports hierarchy tree

```
AD Ports Group
│
├── PORTS CLUSTER (code: PORTS)
│     │
│     ├── Khalifa Port Pool (code: PORTS-KHALIFA)
│     │     ├── Khalifa Port            ← location
│     │     └── Khalifa Logistics City  ← location
│     │
│     └── Zayed Port Pool (code: PORTS-ZAYED)
│           ├── Mina Zayed — Yard A     ← location (PHASE 1 PILOT)
│           └── Mina Zayed — Yard B     ← location
│
├── LOGISTICS CLUSTER (code: LOG)
│     │
│     └── Kezad HQ Pool (code: LOG-KEZAD)
│           ├── Kezad HQ E11            ← location
│           └── Kezad 280               ← location
│
├── MARITIME & SHIPPING CLUSTER (code: MAR)
│     │
│     └── AD Maritime Pool (code: MAR-ADMAR)
│           ├── AD Maritime offices     ← location
│           └── Supporting sites        ← location
│
├── ECONOMIC CITIES & FREE ZONES (code: ECFZ)
│     └── [pools to be confirmed by data steward — Phase 2]
│
├── DIGITAL CLUSTER (code: DIG)
│     └── [pools to be confirmed by data steward — Phase 2]
│         Note: Digital may share buildings with Ports/Corporate
│         See §3 for the shared-building design
│
└── CORPORATE CLUSTER (code: CORP)
      │
      └── GS HQ Pool (code: CORP-GSHQ)  ← PHASE 1 PILOT POOL
            ├── Group HQ                 ← location
            └── Maqta                    ← location
```

---

## 3. Shared Buildings — How the Hierarchy Handles It

### 3.1 The real scenario

Digital cluster and Ports cluster may operate from the same physical building. Their vehicles are different fleets managed by different fleet managers under different clusters. The hierarchy handles this without any special logic:

```
Ports Cluster
  └── Khalifa Port Pool
        └── "Khalifa Port Building A"   ← location record (PORTS-KHALIFA)

Digital Cluster
  └── Digital HQ Pool
        └── "Khalifa Port Building A"   ← location record (DIG-HQ)
                                          ↑ same address string,
                                            different pool, different cluster
```

A vehicle in Ports never becomes visible to a Digital fleet manager, and vice versa — **scope is enforced by role assignment to a pool, not by physical location**. Two separate location records with the same address label exist in the database. This is expected and correct.

### 3.2 Cross-cluster booking (open decision D24)

When a Ports employee needs a vehicle and all Ports pool vehicles are booked, but Digital vehicles are sitting idle in the same yard — should they be bookable?

**FR-CLU-05 allows this by configuration:** cross-cluster booking is supported where business policy permits, with cluster-level approval routing. This is governed by a policy engine rule type (see §6.3) and is OFF by default.

**Open decision D24** (to be resolved before Phase 2 rollout):

| Decision | Owner | Question |
|---|---|---|
| D24 | Group Services / Cluster CEOs | Which cluster pairs permit cross-cluster vehicle booking, and who is the additional approver for each permitted pair? |

---

## 4. PostgreSQL Data Model — Organization & Hierarchy

### 4.1 Core tables

```sql
-- ============================================================
-- HIERARCHY NODES
-- Stores clusters, pools and locations as one unified tree.
-- ============================================================
CREATE TABLE hierarchy_nodes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL DEFAULT '00000000-0000-0000-0000-0000000adp01',
  parent_id        UUID REFERENCES hierarchy_nodes(id),
  level            INTEGER NOT NULL,          -- 0=Cluster, 1=Pool, 2=Location
  level_label      TEXT NOT NULL,             -- "Cluster" | "Pool" | "Location"
  name             TEXT NOT NULL,             -- display name (unique within parent)
  code             TEXT NOT NULL UNIQUE,      -- globally unique code (PORTS-KHALIFA)
  is_active        BOOLEAN NOT NULL DEFAULT true,
  metadata         JSONB DEFAULT '{}',        -- branding, address, extra fields
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- name must be unique within its parent
  CONSTRAINT uq_node_name_within_parent UNIQUE (parent_id, name)
);

-- Seed: AD Ports clusters (Level 0 — no parent)
INSERT INTO hierarchy_nodes (level, level_label, name, code, parent_id) VALUES
  (0, 'Cluster', 'Ports',                       'PORTS',    NULL),
  (0, 'Cluster', 'Logistics',                   'LOG',      NULL),
  (0, 'Cluster', 'Maritime & Shipping',         'MAR',      NULL),
  (0, 'Cluster', 'Economic Cities & Free Zones','ECFZ',     NULL),
  (0, 'Cluster', 'Digital',                     'DIG',      NULL),
  (0, 'Cluster', 'Corporate',                   'CORP',     NULL);

-- Seed: Pools (Level 1)
INSERT INTO hierarchy_nodes (level, level_label, name, code, parent_id)
SELECT 1, 'Pool', pool.name, pool.code, n.id
FROM (VALUES
  ('Khalifa Port Pool',    'PORTS-KHALIFA', 'PORTS'),
  ('Zayed Port Pool',      'PORTS-ZAYED',   'PORTS'),
  ('Kezad HQ Pool',        'LOG-KEZAD',     'LOG'),
  ('AD Maritime Pool',     'MAR-ADMAR',     'MAR'),
  ('GS HQ Pool',           'CORP-GSHQ',     'CORP')
) AS pool(name, code, cluster_code)
JOIN hierarchy_nodes n ON n.code = pool.cluster_code;

-- Seed: Locations (Level 2)
INSERT INTO hierarchy_nodes (level, level_label, name, code, parent_id)
SELECT 2, 'Location', loc.name, loc.code, n.id
FROM (VALUES
  ('Khalifa Port',           'LOC-KHALIFA-GATE',  'PORTS-KHALIFA'),
  ('Khalifa Logistics City', 'LOC-KHALIFA-LOG',   'PORTS-KHALIFA'),
  ('Mina Zayed — Yard A',    'LOC-ZAYED-A',       'PORTS-ZAYED'),
  ('Mina Zayed — Yard B',    'LOC-ZAYED-B',       'PORTS-ZAYED'),
  ('Kezad HQ E11',           'LOC-KEZAD-E11',     'LOG-KEZAD'),
  ('Kezad 280',              'LOC-KEZAD-280',     'LOG-KEZAD'),
  ('Group HQ',               'LOC-CORP-HQ',       'CORP-GSHQ'),
  ('Maqta',                  'LOC-CORP-MAQTA',    'CORP-GSHQ'),
  ('AD Maritime offices',    'LOC-MAR-OFFICES',   'MAR-ADMAR'),
  ('Supporting sites',       'LOC-MAR-SITES',     'MAR-ADMAR')
) AS loc(name, code, pool_code)
JOIN hierarchy_nodes n ON n.code = loc.pool_code;
```

```sql
-- ============================================================
-- HIERARCHY NODE HISTORY
-- Every structural change (rename, move, deactivate) is logged.
-- Historical reports stay attributed to the node AS IT WAS.
-- ============================================================
CREATE TABLE hierarchy_node_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id          UUID NOT NULL REFERENCES hierarchy_nodes(id),
  changed_by       UUID NOT NULL,     -- user who made the change
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type      TEXT NOT NULL,     -- 'RENAME' | 'MOVE' | 'DEACTIVATE' | 'REACTIVATE'
  old_value        JSONB NOT NULL,    -- snapshot before
  new_value        JSONB NOT NULL,    -- snapshot after
  reason           TEXT
);
```

```sql
-- ============================================================
-- VEHICLE — scoped to pool + optional location
-- ============================================================
CREATE TABLE vehicles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL DEFAULT '00000000-0000-0000-0000-0000000adp01',
  pool_id          UUID NOT NULL REFERENCES hierarchy_nodes(id),
  location_id      UUID REFERENCES hierarchy_nodes(id),
  -- ... all other vehicle fields per PRD §P5 data model
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Useful: resolve cluster from a vehicle without a join chain
CREATE VIEW vehicle_hierarchy AS
SELECT
  v.id               AS vehicle_id,
  pool.id            AS pool_id,
  pool.name          AS pool_name,
  pool.code          AS pool_code,
  cluster.id         AS cluster_id,
  cluster.name       AS cluster_name,
  cluster.code       AS cluster_code,
  loc.name           AS location_name
FROM vehicles v
JOIN hierarchy_nodes pool    ON pool.id    = v.pool_id
JOIN hierarchy_nodes cluster ON cluster.id = pool.parent_id
LEFT JOIN hierarchy_nodes loc ON loc.id   = v.location_id;
```

```sql
-- ============================================================
-- DORMANT MULTI-ORG SEAM (ADR-008)
-- organization_id present on all core tables.
-- Single constant value. RLS OFF. App code NEVER references it.
-- CI grep guard prevents any conditional use.
-- ============================================================

-- Applied to: vehicles, bookings, entitlements, drivers,
-- fines, consents, handovers, policies, workflow_instances,
-- audit_log, hierarchy_nodes (already present above)

-- To enable multi-org in the future (two steps, no migration):
-- Step 1: Add session interceptor in NestJS
--   SET LOCAL app.organization_id = '<uuid>';
-- Step 2: Enable RLS per table
--   CREATE POLICY org_isolation ON vehicles
--     USING (organization_id =
--            current_setting('app.organization_id')::uuid);
--   ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- CI guard (add to GitHub Actions pipeline):
-- grep -r "organization_id" src/ \
--   --include="*.ts" | grep -v "migrations/" \
--   && echo "ERROR: organization_id referenced in app code" && exit 1
```

### 4.2 Role scoping to hierarchy nodes

```sql
-- ============================================================
-- USER ROLE ASSIGNMENTS — scoped to a hierarchy node
-- A user can have different roles at different nodes.
-- Fleet Manager of Pool A ≠ Fleet Manager of Pool B.
-- ============================================================
CREATE TABLE user_role_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL DEFAULT '00000000-0000-0000-0000-0000000adp01',
  user_id          UUID NOT NULL,          -- from HR/Entra
  role             TEXT NOT NULL,          -- 'FLEET_MANAGER' | 'CLUSTER_CEO' | etc.
  scope_node_id    UUID NOT NULL REFERENCES hierarchy_nodes(id),
  scope_level      INTEGER NOT NULL,       -- 0=cluster-wide, 1=pool, 2=location
  granted_by       UUID NOT NULL,
  granted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,            -- for temporary assignments
  is_active        BOOLEAN NOT NULL DEFAULT true
);

-- Example: Fleet manager of GS HQ Pool only
INSERT INTO user_role_assignments
  (user_id, role, scope_node_id, scope_level, granted_by)
VALUES
  ('<user-uuid>', 'FLEET_MANAGER',
   (SELECT id FROM hierarchy_nodes WHERE code = 'CORP-GSHQ'),
   1, '<admin-uuid>');

-- Example: Cluster CEO of Ports cluster (sees all Ports pools)
INSERT INTO user_role_assignments
  (user_id, role, scope_node_id, scope_level, granted_by)
VALUES
  ('<ceo-uuid>', 'CLUSTER_CEO',
   (SELECT id FROM hierarchy_nodes WHERE code = 'PORTS'),
   0, '<admin-uuid>');
```

---

## 5. NestJS Implementation — Hierarchy Module

```ts
// src/modules/platform/hierarchy/hierarchy.service.ts
import { Injectable } from '@nestjs/common';
import { db } from '@/database';
import { hierarchyNodes } from '@/database/schema';
import { eq, isNull } from 'drizzle-orm';

@Injectable()
export class HierarchyService {

  // Get the full tree for the scope switcher in the UI
  async getTree(): Promise<HierarchyNode[]> {
    return db.select().from(hierarchyNodes)
      .where(eq(hierarchyNodes.isActive, true))
      .orderBy(hierarchyNodes.level, hierarchyNodes.name);
  }

  // Get all nodes a user can see based on their role assignments
  async getScopeForUser(userId: string): Promise<HierarchyNode[]> {
    const assignments = await db
      .select()
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.isActive, true),
        )
      );

    // For each assignment, return the node + all descendants
    const scopes = await Promise.all(
      assignments.map(a => this.getNodeWithDescendants(a.scopeNodeId))
    );
    return [...new Map(scopes.flat().map(n => [n.id, n])).values()];
  }

  // Resolve cluster from any pool or location
  async getClusterForNode(nodeId: string): Promise<HierarchyNode> {
    const node = await this.getById(nodeId);
    if (node.level === 0) return node;                      // it's already a cluster
    if (node.level === 1) return this.getById(node.parentId!); // parent is cluster
    const pool = await this.getById(node.parentId!);
    return this.getById(pool.parentId!);                    // grandparent is cluster
  }

  async getNodeWithDescendants(nodeId: string): Promise<HierarchyNode[]> {
    // Recursive CTE — efficient in Postgres
    const result = await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT * FROM hierarchy_nodes WHERE id = ${nodeId}
        UNION ALL
        SELECT n.* FROM hierarchy_nodes n
        JOIN descendants d ON n.parent_id = d.id
      )
      SELECT * FROM descendants WHERE is_active = true
    `);
    return result.rows as HierarchyNode[];
  }

  private async getById(id: string): Promise<HierarchyNode> {
    const [node] = await db.select().from(hierarchyNodes)
      .where(eq(hierarchyNodes.id, id));
    return node;
  }
}
```

---

## 6. The Policy Engine — Full Detail

### 6.1 Architecture (PAP / PDP / PEP)

```
┌─────────────────────────────────────────────────────────┐
│  PAP — Policy Administration Point (Admin UI)           │
│  System Admin authors decision tables                   │
│  Submit → Review → Approve → Effective-date → Active    │
└──────────────────────┬──────────────────────────────────┘
                       │ stores versioned JSONB
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Policy Store (PostgreSQL)                              │
│  Versioned, immutable decision tables per rule type     │
│  Scoped: group default → cluster override → pool override│
└──────────────────────┬──────────────────────────────────┘
                       │ evaluate(ruleType, context)
                       ▼
┌─────────────────────────────────────────────────────────┐
│  PDP — Policy Decision Point (pdp deployable)           │
│  Stateless. < 200ms. Fails safe (DENY on outage).       │
│  Returns: decision + reasons + policyVersion + scope    │
└──────────────────────┬──────────────────────────────────┘
                       │ ask → enforce answer
                       ▼
┌─────────────────────────────────────────────────────────┐
│  PEPs — Policy Enforcement Points (in api)              │
│  bookings · entitlements · compliance · fines · workflow│
│  Each calls evaluate() and enforces the answer.         │
│  ZERO rule logic inside any PEP.                        │
└─────────────────────────────────────────────────────────┘
```

### 6.2 The PDP contract

```ts
// contracts/policy.ts — Zod schema, shared between api and pdp
import { z } from 'zod';

export const PolicyDecisionSchema = z.object({
  decision:         z.enum(['ALLOW', 'DENY', 'ROUTE_TO', 'VALUE']),
  reasons:          z.array(z.string()),     // machine-readable reason codes
  reasonMessages:   z.array(z.string()),     // human-readable, translated
  policyVersion:    z.string(),
  scopeThatAnswered:z.enum(['group', 'cluster', 'pool']),
  evaluationMs:     z.number(),
});

export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

// Every rule type declares its own input schema
export const DriverEligibilityInputSchema = z.object({
  driverId:         z.string().uuid(),
  vehicleId:        z.string().uuid(),
  clusterId:        z.string().uuid(),
  poolId:           z.string().uuid(),
  licenceValid:     z.boolean(),
  employmentActive: z.boolean(),
  blackPointsBlock: z.boolean(),
  behaviourBlock:   z.boolean(),
});
```

### 6.3 Phase 1 rule-type catalog (all 12, with scope + decision-table shape)

#### Rule 1: `booking-buffer`

**What it governs:** minimum minutes between consecutive bookings on the same vehicle (to allow inspection, cleaning, handover).

**Input:** `{ vehicleCategory: string }`
**Output:** `VALUE` (the buffer in minutes)

```
Decision table (AD Ports Phase 1):
┌──────────────────┬─────────────────┐
│ Vehicle Category │ Buffer (minutes) │
├──────────────────┼─────────────────┤
│ Bus              │ 20              │
│ Van              │ 15              │
│ Any (default)    │ 10              │
└──────────────────┴─────────────────┘
```

---

#### Rule 2: `max-booking-duration`

**What it governs:** maximum hours a single pool booking can run before triggering an escalation.

**Input:** `{ vehicleCategory: string }`
**Output:** `VALUE` (hours)

```
Decision table (to be confirmed — open decision D14):
┌──────────────────┬──────────────────┐
│ Vehicle Category │ Max hours        │
├──────────────────┼──────────────────┤
│ Bus / Van        │ 12               │
│ Any (default)    │ 8                │
└──────────────────┴──────────────────┘
```

---

#### Rule 3: `booking-approval-chain`

**What it governs:** who approves a pool booking, in what order, with what timeout.

**Input:** `{ employeeGrade: string, clusterId: string, crossCluster: boolean }`
**Output:** `ROUTE_TO` — an ordered list of approver role references

```
Decision table:
┌─────────────────┬──────────────────────────────────────────┐
│ Condition       │ Chain                                    │
├─────────────────┼──────────────────────────────────────────┤
│ Cross-cluster   │ LM → owning Cluster Fleet Lead, 24h     │
│ Any (default)   │ Line Manager (LM), 24h timeout          │
└─────────────────┴──────────────────────────────────────────┘
```

---

#### Rule 4: `entitlement-approval-chain`

**What it governs:** who approves a dedicated vehicle request.

**Input:** `{ employeeGrade: string, clusterId: string, durationMonths: number }`
**Output:** `ROUTE_TO` — ordered approver chain

```
Decision table:
┌──────────────────┬───────────────────────────────────────────────┐
│ Duration         │ Chain                                         │
├──────────────────┼───────────────────────────────────────────────┤
│ > 12 months      │ LM → Cluster Fleet Lead → Cluster CEO, 48h   │
│ ≤ 12 months      │ LM → Cluster Fleet Lead, 48h                 │
│ Any (default)    │ LM → Cluster Fleet Lead, 48h                 │
└──────────────────┴───────────────────────────────────────────────┘
```

---

#### Rule 5: `dedicated-vehicle-eligibility`

**What it governs:** which employee grade and role qualifies for a dedicated vehicle, and which vehicle class.

**Input:** `{ employeeGrade: string, roleTitle: string, clusterId: string, requestType: 'long-term'|'temporary' }`
**Output:** `ALLOW` (with eligible vehicle class) or `DENY`

```
Decision table (to be confirmed — open decision D8):
┌──────────────────┬──────────────────┬─────────────────┬─────────────────────┐
│ Grade            │ Request type     │ Outcome         │ Vehicle class       │
├──────────────────┼──────────────────┼─────────────────┼─────────────────────┤
│ ≥ Director       │ Long-term        │ ELIGIBLE        │ Mid-SUV             │
│ ≥ Director       │ Temporary        │ ELIGIBLE        │ Sedan               │
│ ≥ Manager        │ Temporary ≤30d   │ ELIGIBLE        │ Sedan               │
│ Any              │ Any              │ NOT ELIGIBLE    │ —  ← default row    │
└──────────────────┴──────────────────┴─────────────────┴─────────────────────┘
```

---

#### Rule 6: `driver-eligibility-gate` ← the most critical rule

**What it governs:** the single gate — can this driver take this vehicle, right now? Called on every booking, handover, substitution request.

**Input:** `{ licenceValid: boolean, employmentActive: boolean, blackPointsBlock: boolean, behaviourBlock: boolean, vehicleMulkiyaValid: boolean, vehicleInsuranceValid: boolean }`
**Output:** `ALLOW` or `DENY` with specific reason codes

```
Decision table (evaluated top-down, first match wins):
┌────────────────────┬───────────────────────┬──────────────────────────────────┐
│ Condition          │ Decision              │ Reason code                      │
├────────────────────┼───────────────────────┼──────────────────────────────────┤
│ !employmentActive  │ DENY                  │ DRIVER_INACTIVE                  │
│ !licenceValid      │ DENY                  │ LICENCE_EXPIRED                  │
│ blackPointsBlock   │ DENY                  │ BLACK_POINTS_OVERDUE             │
│ behaviourBlock     │ DENY                  │ BEHAVIOUR_BLOCK_HR_CONFIRMED     │
│ !mulkiyaValid      │ DENY (no override)    │ VEHICLE_REGISTRATION_EXPIRED     │
│ !insuranceValid    │ DENY (no override)    │ VEHICLE_INSURANCE_EXPIRED        │
│ All pass (default) │ ALLOW                 │ —                                │
└────────────────────┴───────────────────────┴──────────────────────────────────┘

CRITICAL: This rule MUST fail safe.
If the PDP is unreachable → answer is DENY + escalate.
A fail-open policy engine would silently allow uninsured vehicles.
```

---

#### Rule 7: `compliance-alert-ladders`

**What it governs:** how many days before expiry to alert, and who to notify, per compliance document type.

**Input:** `{ documentType: string, daysUntilExpiry: number }`
**Output:** `VALUE` (alert recipients list + urgency level)

```
Decision table:
┌──────────────────┬───────────────────┬────────────┬─────────────────────────────┐
│ Document type    │ Days until expiry │ Urgency    │ Recipients                  │
├──────────────────┼───────────────────┼────────────┼─────────────────────────────┤
│ Mulkiya/Reg      │ ≤ 1               │ CRITICAL   │ Fleet Mgr + Procurement     │
│ Mulkiya/Reg      │ ≤ 7               │ HIGH       │ Fleet Mgr + Procurement     │
│ Mulkiya/Reg      │ ≤ 14              │ MEDIUM     │ Fleet Manager               │
│ Mulkiya/Reg      │ ≤ 30              │ MEDIUM     │ Fleet Manager               │
│ Mulkiya/Reg      │ ≤ 60              │ LOW        │ Fleet Manager               │
│ Insurance        │ ≤ 1               │ CRITICAL   │ Fleet Mgr + Insurance Lead  │
│ Insurance        │ ≤ 7               │ HIGH       │ Fleet Mgr + Insurance Lead  │
│ Insurance        │ ≤ 14              │ MEDIUM     │ Fleet Manager               │
│ Insurance        │ ≤ 30              │ MEDIUM     │ Fleet Manager               │
│ Insurance        │ ≤ 60              │ LOW        │ Fleet Manager               │
│ Lease            │ ≤ 30              │ HIGH       │ Fleet Mgr + Procurement     │
│ Lease            │ ≤ 60              │ MEDIUM     │ Fleet Mgr + Procurement     │
│ Lease            │ ≤ 90              │ LOW        │ Procurement                 │
│ Driver Licence   │ ≤ 7               │ HIGH       │ Driver + LM + HR            │
│ Driver Licence   │ ≤ 14              │ MEDIUM     │ Driver + Line Manager       │
│ Driver Licence   │ ≤ 30              │ LOW        │ Driver                      │
│ Any (default)    │ any               │ NONE       │ —                           │
└──────────────────┴───────────────────┴────────────┴─────────────────────────────┘
```

---

#### Rule 8: `hard-block-conditions`

**What it governs:** conditions that absolutely block a booking with zero override at any role, including System Admin.

**Input:** `{ vehicleMulkiyaExpired: boolean, vehicleInsuranceExpired: boolean }`
**Output:** `DENY` (no override path exists — this is structural, not configurable)

This rule type is special: the "no override" property is **structural** — it is not a flag in the decision table. The PDP returns DENY, the booking PEP blocks, and there is no escalation path above it. This is enforced at the authorization layer, not the UI.

---

#### Rule 9: `fines-hr-threshold`

**What it governs:** how many fines within a rolling window triggers an automatic HR escalation.

**Input:** `{ fineCount: number, windowDays: number, clusterId: string }`
**Output:** `ALLOW` (no action) or `ROUTE_TO` HR escalation

```
Decision table (AD Ports default):
┌────────────────────┬───────────────────────────────┐
│ Condition          │ Action                        │
├────────────────────┼───────────────────────────────┤
│ fineCount ≥ 3      │ ROUTE_TO HR + Line Manager   │
│ fineCount < 3      │ ALLOW (no action) — default  │
└────────────────────┴───────────────────────────────┘
Window: 12 months rolling (configurable per cluster)
```

---

#### Rule 10: `black-point-transfer-timeframe`

**What it governs:** how many days a driver has to transfer black points to their personal traffic file before the platform-wide block activates.

**Input:** `{ daysSinceViolation: number }`
**Output:** `VALUE` (deadline in days) or `DENY` (block if overdue)

```
Decision table (to be confirmed — open decision D9):
┌─────────────────────────┬────────────────────────────────────────┐
│ Condition               │ Action                                 │
├─────────────────────────┼────────────────────────────────────────┤
│ Transfer overdue        │ DENY — platform-wide block             │
│ Transfer due in ≤ 7 days│ VALUE: warn driver + LM               │
│ Transfer not yet due    │ ALLOW                                  │
└─────────────────────────┴────────────────────────────────────────┘
The block flows to the eligibility gate (Rule 6: blackPointsBlock=true)
```

---

#### Rule 11: `consent-reconsent-tolerance`

**What it governs:** when a booking modification requires a fresh consent (vs. carrying the original).

**Input:** `{ driverChanged: boolean, vehicleCategoryChanged: boolean, windowShiftHours: number }`
**Output:** `ALLOW` (original consent carries) or `DENY` (new consent required)

```
Decision table (to be confirmed — open decision D12):
┌───────────────────────────┬────────────────────────────────────────┐
│ Condition                 │ Decision                               │
├───────────────────────────┼────────────────────────────────────────┤
│ driverChanged = true      │ DENY — new consent required            │
│ vehicleCategoryChanged    │ DENY — new consent required            │
│ windowShiftHours > 4      │ DENY — new consent required            │
│ Any (default)             │ ALLOW — original consent carries       │
└───────────────────────────┴────────────────────────────────────────┘
```

---

#### Rule 12: `fuel-deviation-threshold`

**What it governs:** what percentage difference between expected and actual fuel triggers a fleet-manager review flag.

**Input:** `{ vehicleCategory: string, deviationPercent: number }`
**Output:** `ALLOW` (within tolerance) or `VALUE` (flag for review — advisory only, never blocks)

```
Decision table (AD Ports default):
┌──────────────────┬──────────────────┬─────────────────────────────┐
│ Vehicle Category │ Deviation        │ Action                      │
├──────────────────┼──────────────────┼─────────────────────────────┤
│ Bus              │ > 25%            │ FLAG — advisory review      │
│ Any              │ > 20%            │ FLAG — advisory review      │
│ Any (default)    │ ≤ 20%            │ ALLOW — within tolerance    │
└──────────────────┴──────────────────┴─────────────────────────────┘
Note: fuel deviation is ALWAYS advisory. It never blocks a booking or return.
Alert fatigue risk: tune per vehicle category in the table, not via code.
```

### 6.4 PostgreSQL schema for the policy engine

```sql
-- ============================================================
-- POLICY RULE TYPES — registered rule types with their contracts
-- ============================================================
CREATE TABLE policy_rule_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL DEFAULT '00000000-0000-0000-0000-0000000adp01',
  rule_type        TEXT NOT NULL UNIQUE,       -- 'driver-eligibility-gate'
  description      TEXT NOT NULL,
  input_schema     JSONB NOT NULL,             -- JSON Schema for inputs
  output_type      TEXT NOT NULL,              -- 'ALLOW_DENY' | 'ROUTE_TO' | 'VALUE'
  safe_default     TEXT NOT NULL,              -- 'DENY' | 'ALLOW' | 'ESCALATE'
  high_impact      BOOLEAN NOT NULL DEFAULT false, -- requires 2nd-person approval to change
  phase_introduced INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- POLICY VERSIONS — immutable, versioned decision tables
-- ============================================================
CREATE TABLE policy_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL DEFAULT '00000000-0000-0000-0000-0000000adp01',
  rule_type_id     UUID NOT NULL REFERENCES policy_rule_types(id),
  scope_node_id    UUID REFERENCES hierarchy_nodes(id), -- NULL = group-level default
  scope_level      TEXT,                       -- 'group' | 'cluster' | 'pool'
  version          TEXT NOT NULL,              -- '1.0', '1.1', '2.0'
  status           TEXT NOT NULL DEFAULT 'draft',
  -- status: 'draft' | 'in_review' | 'approved' | 'active' | 'superseded'
  decision_table   JSONB NOT NULL,             -- the rows
  effective_from   TIMESTAMPTZ,
  effective_until  TIMESTAMPTZ,
  authored_by      UUID NOT NULL,
  approved_by      UUID,                       -- required for high_impact rules
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_one_active_per_scope
    UNIQUE (rule_type_id, scope_node_id, status)
    WHERE status = 'active'
);

-- ============================================================
-- POLICY DECISION LOG — every PDP evaluation recorded
-- ============================================================
CREATE TABLE policy_decision_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL DEFAULT '00000000-0000-0000-0000-0000000adp01',
  rule_type        TEXT NOT NULL,
  policy_version   TEXT NOT NULL,
  scope_answered   TEXT NOT NULL,              -- 'group' | 'cluster' | 'pool'
  input_context    JSONB NOT NULL,
  decision         TEXT NOT NULL,
  reasons          TEXT[] NOT NULL,
  evaluation_ms    INTEGER NOT NULL,
  requesting_module TEXT NOT NULL,             -- 'bookings' | 'entitlements' | etc.
  requesting_user  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- This table is append-only. No updates, no deletes.
-- Index for audit queries:
CREATE INDEX ON policy_decision_log (rule_type, created_at DESC);
CREATE INDEX ON policy_decision_log (requesting_user, created_at DESC);
```

### 6.5 Scope resolution — how the PDP picks the right rule

The policy engine supports scope inheritance: a pool-level rule overrides a cluster-level rule, which overrides the group default. The PDP resolves scope from most specific to least:

```
Pool rule exists for this pool?        → use it
  No → Cluster rule exists for this cluster? → use it
    No → Group default exists?               → use it
      No → safe_default applies              → DENY / escalate
```

```sql
-- Scope resolution query used by the PDP
SELECT pv.*
FROM policy_versions pv
JOIN policy_rule_types prt ON prt.id = pv.rule_type_id
WHERE prt.rule_type = $1              -- e.g. 'driver-eligibility-gate'
  AND pv.status = 'active'
  AND pv.effective_from <= now()
  AND (pv.effective_until IS NULL OR pv.effective_until > now())
  AND (
    -- Most specific first
    pv.scope_node_id = $2            -- exact pool match
    OR pv.scope_node_id = $3         -- cluster of this pool
    OR pv.scope_node_id IS NULL      -- group default
  )
ORDER BY
  CASE
    WHEN pv.scope_node_id = $2 THEN 0     -- pool wins
    WHEN pv.scope_node_id = $3 THEN 1     -- cluster next
    ELSE 2                                 -- group default last
  END
LIMIT 1;
```

### 6.6 The PDP service (NestJS)

```ts
// src/modules/policy/pdp.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { db } from '@/database';

@Injectable()
export class PdpService {
  private readonly logger = new Logger(PdpService.name);

  constructor(private readonly redis: Redis) {}

  async evaluate(
    ruleType: string,
    context: Record<string, unknown>,
    scope: { poolId: string; clusterId: string },
  ): Promise<PolicyDecision> {
    const start = Date.now();

    try {
      // 1. Try Redis cache first
      const cacheKey = `pdp:${ruleType}:${scope.poolId}`;
      const cached = await this.redis.get(cacheKey);
      const rule = cached
        ? JSON.parse(cached)
        : await this.loadAndCacheRule(ruleType, scope, cacheKey);

      // 2. Evaluate decision table (top-down, first match)
      const match = this.evaluateTable(rule.decisionTable, context);

      // 3. Log every evaluation (append-only)
      await this.logDecision(ruleType, rule.version,
        rule.scopeAnswered, context, match, Date.now() - start);

      return {
        decision:          match.decision,
        reasons:           match.reasons ?? [],
        reasonMessages:    this.translate(match.reasons ?? []),
        policyVersion:     rule.version,
        scopeThatAnswered: rule.scopeAnswered,
        evaluationMs:      Date.now() - start,
      };

    } catch (err) {
      // FAIL SAFE — never fail open
      this.logger.error(`PDP evaluation failed for ${ruleType}`, err);
      await this.logDecision(ruleType, 'UNKNOWN', 'error',
        context, { decision: 'DENY', reasons: ['PDP_UNAVAILABLE'] },
        Date.now() - start);

      return {
        decision:          'DENY',
        reasons:           ['PDP_UNAVAILABLE'],
        reasonMessages:    ['Policy service unavailable — access denied for safety. Contact fleet manager.'],
        policyVersion:     'UNKNOWN',
        scopeThatAnswered: 'group',
        evaluationMs:      Date.now() - start,
      };
    }
  }

  private evaluateTable(
    rows: DecisionRow[],
    context: Record<string, unknown>
  ): DecisionRow {
    for (const row of rows) {
      if (this.rowMatches(row.conditions, context)) {
        return row;
      }
    }
    throw new Error('No default row in decision table — this should never happen');
  }

  private rowMatches(
    conditions: Record<string, unknown>,
    context: Record<string, unknown>
  ): boolean {
    return Object.entries(conditions).every(([key, expected]) => {
      if (expected === '*') return true;         // wildcard
      if (expected === null) return true;        // default row marker
      return context[key] === expected;
    });
  }
}
```

### 6.7 A PEP calling the PDP — booking example

```ts
// src/modules/bookings/bookings.service.ts
// This is a PEP. It asks. It never decides.

@Injectable()
export class BookingsService {
  constructor(private readonly pdp: PdpService) {}

  async createBooking(dto: CreateBookingDto, userId: string) {

    // 1. Resolve the pool's cluster for scope
    const scope = await this.hierarchy.getScopeForNode(dto.poolId);

    // 2. Ask the PDP — driver eligibility
    const eligibility = await this.pdp.evaluate(
      'driver-eligibility-gate',
      {
        licenceValid:      driver.licenceValid,
        employmentActive:  driver.employmentActive,
        blackPointsBlock:  driver.blackPointsBlock,
        behaviourBlock:    driver.behaviourBlock,
        vehicleMulkiyaValid:  vehicle.mulkiyaValid,
        vehicleInsuranceValid: vehicle.insuranceValid,
      },
      scope
    );

    if (eligibility.decision === 'DENY') {
      throw new ForbiddenException({
        code: 'ELIGIBILITY_DENIED',
        reasons: eligibility.reasons,
        message: eligibility.reasonMessages,
        policyVersion: eligibility.policyVersion,
      });
      // → User sees: "Booking unavailable — licence expired 12 Mar.
      //               Renew with HR, then try again."
    }

    // 3. Ask the PDP — booking buffer
    const buffer = await this.pdp.evaluate(
      'booking-buffer',
      { vehicleCategory: vehicle.category },
      scope
    );
    const bufferMinutes = buffer.decision === 'VALUE'
      ? parseInt(buffer.reasons[0])
      : 10; // fallback to 10 if somehow wrong

    // 4. Check availability respecting the buffer
    const available = await this.checkAvailability(
      dto.vehicleId, dto.window, bufferMinutes
    );
    if (!available) throw new ConflictException('VEHICLE_NOT_AVAILABLE');

    // 5. Consent must be captured before booking number is issued
    // (enforced upstream — bookings.controller.ts)

    // 6. Create booking — policy is already decided
    const booking = await db.insert(bookings).values({ ...dto, userId });

    // 7. Ask the PDP — approval chain
    const chain = await this.pdp.evaluate(
      'booking-approval-chain',
      { employeeGrade: driver.grade, clusterId: scope.clusterId,
        crossCluster: dto.crossCluster ?? false },
      scope
    );
    await this.workflow.startChain(booking.id, chain);

    return booking;
  }
}
```

---

## 7. How Policy Engine Connects to Organization & Hierarchy

```
                    AD PORTS GROUP
                         │
              ┌──────────┼──────────┐
              │          │          │
          PORTS        LOG        CORP
          Cluster    Cluster     Cluster
              │          │          │
         Zayed Pool  Kezad Pool  GS Pool ← Phase 1 pilot
              │
        Yard A · Yard B
              │
         [vehicle]
              │
         [booking] ──── asks PDP ──── [driver-eligibility-gate]
                              │
                    Scope resolution:
                    1. Is there a pool-level rule for GS Pool?   → use it
                    2. Is there a cluster-level rule for CORP?   → use it
                    3. Group default?                            → use it
                    4. safe_default                              → DENY
                              │
                    Decision logged → audit_log
```

**The key connection:** every PDP evaluation carries `poolId` and `clusterId`. The PDP uses these to look up the most-specific applicable decision table. This means:

- You can configure a stricter `fines-hr-threshold` (e.g. 2 fines, not 3) for the Ports cluster specifically, without affecting Corporate
- You can configure a longer booking `max-booking-duration` for Maritime vessels without touching other clusters
- When a second organization deploys the same code, they simply seed entirely different decision tables — the engine is the same, the rules are theirs

---

## 8. Open Decisions That Must Be Closed Before Build

| # | Decision | Owner | Blocks |
|---|---|---|---|
| D8 | Dedicated-vehicle eligibility policy (grade thresholds, role exceptions, cluster variations) | Group HR / Cluster CEOs | Rule 5 decision table |
| D9 | Black-point transfer timeframe and escalation cadence | Group HR / Legal | Rule 10 decision table |
| D12 | Consent re-consent tolerance (what changes require new consent) | Legal / Group Services | Rule 11 decision table |
| D14 | Utilisation definition and max-booking-duration per category | Group Services / Finance | Rule 2 decision table |
| D24 | Cross-cluster booking policy — which cluster pairs permit it, who approves | Group Services / Cluster CEOs | Rule 3 + FR-CLU-05 |

---

## 9. One-Page Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  AD PORTS GROUP (one deployment, one PostgreSQL database)        │
│                                                                   │
│  hierarchy_nodes table                                            │
│  └── Level 0: 6 Clusters (PORTS, LOG, MAR, ECFZ, DIG, CORP)    │
│       └── Level 1: 5+ Pools (each cluster has 1 or more)        │
│            └── Level 2: Locations / Yards                        │
│                                                                   │
│  Same physical building → two location records, different pools  │
│  Same pool name allowed → must have unique code (PORTS-X, DIG-X)│
│  Cross-cluster booking → OFF by default, configurable (D24)     │
│                                                                   │
│  organization_id on every core table (dormant, ADR-008)         │
│  → RLS OFF, single default UUID, no app-code references         │
│  → If second org arrives: add RLS, no data migration needed      │
│                                                                   │
│  policy_versions table                                            │
│  └── 12 rule types (Phase 1)                                     │
│  └── Scope: group → cluster → pool (most specific wins)         │
│  └── Every evaluation logged (append-only)                       │
│  └── PDP fails safe (DENY on outage, never ALLOW)               │
│                                                                   │
│  PEP modules (booking, entitlement, compliance, fines)          │
│  └── Call pdp.evaluate(ruleType, context, scope)                 │
│  └── Enforce the answer — ZERO rule logic inside a PEP          │
└─────────────────────────────────────────────────────────────────┘
```
