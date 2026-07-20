# Guidance

Use this reference with `adp-arch-domain` when the request needs more role-specific judgment than the workflow file contains.

## Scope

- **Owner role:** `ai-solution-architect`
- **Primary artifact:** docs/03-architecture/DOMAIN/domain-model.md, docs/03-architecture/DOMAIN/domain-*.drawio
- **Use when:** the request needs artifact examples, edge-case handling, or a concise opinion pack before producing or reviewing the artifact.

## AD Ports Checks

- Tenant or terminal boundary impact.
- Arabic/RTL, accessibility, or operational-user impact.
- UAE data residency, NESA, PDPL, and audit evidence impact.
- Vessel, customs, maritime SLA, SAP/Oracle, or Port Community System dependency.

## Draw.io Domain Model Guidance

- Use UML class-diagram notation for `domain-*.drawio`; do not draw domain concepts as simple labeled boxes.
- Represent each aggregate root, entity, value object, domain service, and external system as a class-style shape with compartments.
- Put the stereotype in the header: `<<AggregateRoot>>`, `<<Entity>>`, `<<ValueObject>>`, `<<DomainService>>`, or `<<ExternalSystem>>`.
- Put key attributes in the attribute compartment with types when known; include identity and business-significant lifecycle states.
- Put domain behaviors, commands, transitions, or invariants in the behavior compartment only when they affect implementation or ownership.
- Use connectors that show relationship semantics: association, aggregation, composition, dependency, or inheritance.
- Add multiplicity at relationship ends: `1`, `0..1`, `0..*`, `1..*`; label ownership or important business rules on the connector.
- Use plain containers only for bounded contexts or modules, never for entities.
- If evidence does not confirm attributes or multiplicity, include an explicit `TBD from source evidence` row or connector label rather than hiding the gap.

## Handoff Notes

- Summarize the source evidence used.
- List assumptions and open questions explicitly.
- Name downstream role(s) before marking the work complete.
