---
name: adp-pm-backlog
description: "Deprecated compatibility alias for product backlog planning. Use adp-plan-wave for wave, backlog, roadmap, iteration, dependency, capacity, and parallel AI-agent planning."
---

# adp-pm-backlog

## Metadata

- **kind:** skill
- **version:** 0.1.2
- **stability:** alpha
- **role:** ai-product-manager
- **tiers:** essentials: baseline · advanced: baseline · enterprise: baseline
- **why_critical:** Preserves compatibility for older catalog consumers while routing backlog planning into the single wave planning source of truth.
- **default_prompt:** Use the adp-plan-wave skill. Treat adp-pm-backlog as a deprecated alias and produce or update docs/04-planning/wave-plan.md.
- **short_description:** Deprecated alias for wave backlog planning
- **catalog_visibility:** deprecated
- **merged_into:** adp-plan-wave

**Owner role:** AI Product Manager (`ai-product-manager`)
**Primary artifact:** `docs/04-planning/wave-plan.md`

## Purpose

This skill ID is kept only as a backward-compatible catalog alias. Do not create a separate product backlog artifact from this skill.

## Abu Dhabi Ports Group context

Apply the merged `adp-plan-wave` skill for AD Ports backlog planning. Preserve wave traceability for tenant-aware delivery, Arabic/RTL user impact, data residency, NESA/PDPL expectations, vessel operations, customs dependencies, SAP/Oracle windows, operational blackout windows, cutover risk, and audit evidence.

## Ownership

- **Primary owner:** AI Product Manager (`ai-product-manager`)
- **Review cadence:** review whenever `adp-plan-wave` changes.
- **Last reviewed:** 2026-07-08
- **Standards:** use `/standards/` references through `adp-plan-wave`.

Use `adp-plan-wave` for:

- wave planning
- iteration or sprint slices
- backlog inventory and traceability
- roadmap sequencing
- parallel AI-agent work package boundaries
- dependencies, capacity, milestones, risks, and readiness gates

## Handoff

Open `catalog/source/skills/adp-plan-wave/SKILL.md` and follow its matching workflow.

## Workflows

- `workflows/use-wave-plan.md` routes this deprecated alias to `adp-plan-wave`.

## References

- `references/guidance.md`
