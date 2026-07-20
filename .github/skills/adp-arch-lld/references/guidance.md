# Guidance

Use this reference with `adp-arch-lld` when the request needs more role-specific judgment than the workflow file contains.

## Scope

- **Owner role:** `ai-solution-architect`
- **Primary artifacts:** foundation-lld.md, module-lld-*.md, lld.md, lld-*.drawio
- **Use when:** the request needs artifact examples, edge-case handling, or a concise opinion pack before producing or reviewing the artifact.

## LLD Artifact Model

- **HLD is outside this skill.** Route architecture story, drivers, context, conceptual/logical/physical views, NFRs, ADRs, and risks to `adp-arch-hld`.
- **Foundational LLD is inside this skill.** Use one document for shared engineering rules only. It answers what every module must follow and must not contain business-module detail.
- **Module LLD Pack is inside this skill.** Use one pack per module, service, capability, integration, or bounded component. It answers how that module works and may be repeated for multi-module scope.
- **Delivery Specs are outside this skill.** Route user stories, acceptance criteria, test cases, implementation tasks, and AI/developer task prompts to product, planning, QA, or implementation-owner skills.

When a request says "the LLD" but scope spans more than one module or technology, ask whether a Foundational LLD plus multiple Module LLD packs is expected unless the source artifacts already make the split clear. If the user requests a single artifact, record the risk of single-document overload.

## AD Ports Checks

- Tenant or terminal boundary impact.
- Arabic/RTL, accessibility, or operational-user impact.
- UAE data residency, NESA, PDPL, and audit evidence impact.
- Vessel, customs, maritime SLA, SAP/Oracle, or Port Community System dependency.

## Handoff Notes

- Summarize the source evidence used.
- State the LLD artifact shape chosen and why.
- List assumptions and open questions explicitly.
- Name downstream role(s) before marking the work complete.
