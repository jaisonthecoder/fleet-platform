# ADR-003 — Tenancy controls: visibility link table, mapping approval, impersonation defaults

| | |
|---|---|
| **Status** | Accepted for build; items 2 and 3 **pending sponsor sign-off** (Mohamed) · 04.09.2026 |
| **Context** | PRD §6/§7 require row-level security by customer group and impersonation with audit, and FG-8.1 requires grouping CW1 org codes into customer groups. The PRD does not say how ownership is decided for shipments with several customer parties, nor how mapping changes are controlled. |

## Decisions

1. **Two tenancy patterns.** Single-owner tables carry `customer_group_id`. The shipment family uses a `shipment_visibility` link table because one shipment can legitimately be visible to two customers (shipper and consignee). Visibility is derived only from `customer_account.cw1_org_code` matching shipment parties, under a single global policy (local client, shipper, consignee grant; notify party and agent do not). *Within PRD scope — an implementation of §6.*
2. **Second-person approval for org-code mapping.** Linking, moving or suspending an org code is requested by one Noatum user and approved by another; the requester cannot approve. *Addition beyond the PRD.* Rationale: this single action decides which company sees which cargo; the control costs one click. If the sponsor declines, the request/approve pair collapses to a confirm dialog with the same audit rows and re-evaluation job.
3. **Impersonation is read-only by default**, time-boxed to 60 minutes, with a mandatory reason and dual-id audit; writes require an explicit flag. *Addition beyond the PRD* (PRD requires impersonation with audit only).

## Consequences

Pattern B policies use an `EXISTS` on the link table; child tables join through `shipment_id`. Mapping changes trigger visibility re-evaluation. Admin UI has an approvals inbox. Tests T-16.1–T-16.8 and T-16.18 in the LLD enforce these decisions.
