# O1 - Data Quality and Master-Data Remediation

## Objective

Measure, quarantine and safely remediate current hierarchy defects before constraints or write APIs make them harder to correct.

## Current verified findings

- One organization (`REF`, Reference Organization).
- Seven active nodes and four roots.
- Three orphan level-2 integration-test pools (`Ho Pool ...`) are active roots.
- Four original seeded nodes have null `name_ar` and `level_code` in the live DB.
- Six people have no home pool.
- Eighteen active role assignments reference three valid scopes; no cross-organization mismatch found.
- No active vehicle hierarchy assignments currently exist.

## Owners and dependencies

- Primary: Data Steward and Database Engineer
- Contributors: Product, Backend, HR/HCM owner, QA
- Depends on: O0
- Human gate: remediation and approved seed/import file

## Work items

1. Produce a repeatable quality report: roots, orphans, duplicate paths/codes/names, invalid levels, missing bilingual metadata, missing home scopes, active dependencies and organization mismatches.
2. Identify test-created rows through deterministic test provenance, not name pattern alone.
3. Delete/quarantine leaked test nodes only after proving no person, role, vehicle, entitlement, policy or workflow references them.
4. Backfill seeded `level_code` and Arabic names through migration/upsert, not ad hoc local SQL.
5. Resolve six missing home-pool assignments with HCM/business ownership; do not guess silently.
6. Reconcile the candidate AD Ports hierarchy into an approved import artifact with stable codes and bilingual labels.
7. Make seed scripts update existing rows idempotently and validate expected topology after run.
8. Fix integration fixtures to use unique organization/test scope and guaranteed cleanup; preserve pre-existing developer data.

## Data-quality report contract

Return counts and row references for roots, invalid parents, level gaps, missing codes/Arabic labels, expired-parent active-child, assignment mismatches, duplicate paths/codes, home-scope gaps and dependency counts.

## Tests

- Quality query fixtures for every defect category.
- Seed twice -> identical approved topology.
- Integration suite leaves no additional active hierarchy roots.
- Cleanup refuses referenced nodes.
- Approved import validates parent/code/level/Arabic requirements.

## Migration and rollback

Use additive/backfill migration with pre/post assertions. Export affected rows before cleanup. Compensating migration restores quarantined rows and prior metadata if verification fails.

## Exit gate

O1 passes when the live and fresh-seed databases have the approved root count/topology, no unexplained test artifacts, mandatory metadata is complete, and unresolved home scopes have named owners and dates.
