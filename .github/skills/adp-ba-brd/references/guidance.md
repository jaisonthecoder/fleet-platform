# Guidance

## Scope

Use this reference for detailed decisions that are too specific for `SKILL.md`.

This `adp-ba-brd` reference is intended for BRD drafting, review, and update requests that need tighter guidance on problem framing, stakeholder evidence, success metrics, requirement quality, and downstream FR/NFR handoff readiness while preserving the approved BRD template exactly.

## Template First

The approved template at `../templates/brd-template.md.tmpl` is the structure contract. Do not add, remove, rename, or reorder headings, tables, optional blocks, or annexes.

Use BABOK v3 only as the analysis lens. Fit the analysis into the approved sections:

| Template section | BABOK source / purpose |
|------------------|------------------------|
| Executive Summary | Decision summary for sponsor approval |
| 1. Business Context | Strategy Analysis - Analyze Current State |
| 1.4 Drivers for Change | Source-backed business, regulatory, operational, customer, cost, risk, or strategic drivers |
| 2. Objectives and Scopes | Define Future State / Define Change Strategy |
| 2.1.2 Success Metrics | Measurable business outcomes tied to objectives |
| 2.2 Scopes | In scope, out of scope, release scope, and user/stakeholder scope |
| 3. Future State | Target business outcome, future process summary, and business rules/policies |
| 4. Requirements | BABOK requirement classification: business, stakeholder, transition |
| 5. Assumptions, Constraints, and Dependencies | Explicit delivery and business conditions |
| 6. Risks and Open Questions | Risk and unresolved information ownership |
| 7. Traceability and Handoff | Driver -> objective -> BR -> SR/TR -> downstream FR/NFR traceability |
| Annex A | Glossary and acronyms |
| Annex B | References and source evidence |

## Classification Rules

- `BR` rows state what outcome the business needs and why.
- `SR` rows state what a specific stakeholder group needs to realize a BR.
- `TR` rows state what is needed only during the change, such as migration, training, cutover, readiness, communication, decommissioning, or temporary support.
- Every `SR` and `TR` row links to at least one `BR` ID.
- Solution requirements belong to downstream FR/NFR artifacts. In the BRD, capture only the traceability and handoff signals in section 7.

## Exceptions

- Do not add an ISO/IEC/IEEE 29148 supplement by default. If ISO conformance is explicitly requested, ask whether the approved template should be updated before adding content outside it.
- Do not add AD Ports checks, PM readiness, evidence, approvals, or template deviation sections unless the user explicitly changes the approved template.
- AD Ports-specific context still belongs in the approved sections: Background, Drivers for Change, Business Rules and Policies, Constraints, Risks, Open Questions, References, and Handoff Notes.

## Rules

- Keep the BRD business-owned. Describe what outcome the business needs and why; do not prescribe UI, API, architecture, implementation, or delivery sequencing.
- Preserve source traceability. Every problem, driver, requirement, metric, constraint, assumption, risk, open question, and handoff note should point to a source artifact, stakeholder, telemetry/report, ticket, regulation, or `TBD`.
- Split requirements at decision boundaries. If one requirement contains multiple outcomes, personas, systems, or priorities, split it into separate rows.
- Keep requirement classes separate: stakeholder needs go to `SR-###`, transition needs go to `TR-###`.
- Keep metrics auditable using the exact template columns: linked objective, metric, baseline, target, timeframe, and owner.
- Make open questions actionable. Each question needs an owner, needed-by date, and impact if unanswered. Do not hide missing information inside prose.
- Keep repeated drafts stable. Do not vary section order, IDs, status labels, or handoff roles for style. Update only facts that changed or gaps that were resolved.

## Review Checklist

- The BRD headings and table columns match `../templates/brd-template.md.tmpl` exactly.
- No unapproved sections were added.
- Problem context names who is affected, what hurts, and why now.
- Every driver has a source/evidence entry.
- Objectives map to measurable success metrics.
- Scope boundaries are clear: in-scope, out-of-scope, release scope, and user/stakeholder scope.
- Every `BR-###`, `SR-###`, and `TR-###` row is in the correct subsection.
- Every `SR-###` and `TR-###` row links to at least one `BR-###` ID.
- Assumptions, constraints, dependencies, risks, and open questions are separated rather than blended.
- Section 7 maps driver IDs, objective IDs, BR IDs, SR/TR IDs, and downstream FR/NFR placeholders.
- Annex B references give reviewers enough evidence to challenge or approve the BRD without relying on chat history.
