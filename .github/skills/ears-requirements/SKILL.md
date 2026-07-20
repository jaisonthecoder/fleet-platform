---
name: ears-requirements
description: >-
  Gather, write, classify, and review software/system requirements using EARS
  (Easy Approach to Requirements Syntax). Use this skill whenever the user is
  eliciting or documenting requirements, wants to turn vague or messy
  requirements into clear testable ones, mentions "EARS", "the system shall",
  "shall statements", acceptance criteria, a requirements/SRS document, user
  stories that need formal requirements, or asks to review requirements for
  ambiguity or testability — even if they don't say "EARS" by name. Trigger it
  for any task that involves producing or critiquing requirement statements.
---

# EARS Requirements

EARS (Easy Approach to Requirements Syntax) is a lightweight set of five sentence
patterns that turn free-form natural-language requirements into clear, consistent,
testable statements — without the overhead of a formal specification language.
It was developed by Alistair Mavin and colleagues at Rolls-Royce (published at the
IEEE RE'09 conference) and is now widely used across aerospace, automotive, medical,
industrial, and enterprise software.

The whole idea: constrain how a requirement is *phrased* using a small handful of
keywords, and most of the usual defects in natural-language requirements disappear.

## When to reach for this skill

Use it to:
- **Elicit** requirements from a stakeholder, a feature idea, a design doc, or a transcript.
- **Author** new requirements directly in EARS form.
- **Rewrite** vague/ambiguous/compound requirements into clean EARS statements.
- **Classify** existing requirements into the correct EARS pattern.
- **Review** a requirement set for ambiguity, testability, completeness, and duplication.
- **Produce** a requirements document / SRS section.

## The problems EARS fixes

Free-text requirements routinely suffer from eight recurring defects. Keep these in
mind — every rule in this skill exists to prevent one of them:

ambiguity · vagueness · complexity · omission · duplication · wordiness ·
implementation detail (saying *how* instead of *what*) · untestability.

## The generic EARS template

Every EARS requirement is an instance of one underlying template. Optional clauses
are in brackets; the system name and `shall` response are always present:

```
[While <precondition(s)>,] [When <trigger>,] the <system name> shall <system response>.
```

Two special cases sit outside that skeleton: **Where** (optional-feature) prefixes it,
and **If/Then** replaces it for unwanted behavior. All five patterns are below.

## The five patterns (quick reference)

| Pattern | Keyword(s) | Use when the behavior… | Syntax |
|---|---|---|---|
| **Ubiquitous** | *(none)* | is always active — a fundamental, ever-present property | `The <system> shall <response>.` |
| **State-driven** | **While** | is active *continuously* the whole time a state/mode holds | `While <state>, the <system> shall <response>.` |
| **Event-driven** | **When** | is triggered by a *detectable event or input* | `When <trigger>, the <system> shall <response>.` |
| **Optional-feature** | **Where** | applies *only if* a feature/configuration is present | `Where <feature is included>, the <system> shall <response>.` |
| **Unwanted behavior** | **If … Then** | handles an *error, fault, or undesired condition* | `If <unwanted condition>, then the <system> shall <response>.` |
| **Complex** | *(combined)* | needs more than one of the above | `While <state>, When <trigger>, the <system> shall <response>.` |

`shall` marks a binding obligation and is used for **every** requirement. Do not mix in
`will`, `should`, `must`, or `may` — reserve those for non-requirement prose. See
`references/patterns.md` for the full treatment, keyword-ordering rules for complex
requirements, and many worked examples per pattern.

## Choosing the right pattern

Ask these questions in order and stop at the first "yes":

1. Does it only apply when an optional feature/config is present? → **Where** (optional-feature)
2. Does it handle an error, failure, fault, or unwanted condition? → **If/Then** (unwanted behavior)
3. Is it triggered by a discrete event, input, command, or message? → **When** (event-driven)
4. Is it active continuously throughout a state or mode? → **While** (state-driven)
5. Is it always true, regardless of state or event? → *(no keyword)* (ubiquitous)
6. Does more than one of the above apply at once? → **Complex** (combine keywords)

The classic confusion is **When vs. While**. When = a momentary trigger ("when the
button is pressed"); While = a sustained condition ("while the door is open"). If the
clause describes something that starts and finishes in an instant, it's *When*; if it
describes a span of time during which the requirement holds, it's *While*.

## The workflow

Work through these steps. Don't skip elicitation — most requirement defects are
*omissions*, and you can't fix what you never asked about.

### 1. Understand scope and name the system
Pin down the exact `<system name>` that will be the grammatical subject of every
requirement (e.g. "the Payment Service", "the Gateway", "the Carpool app"). Requirements
about different systems/subsystems belong in different sections. Establish a short
glossary of domain terms up front so wording stays consistent.

### 2. Elicit
For each capability, probe the five dimensions that map to the five patterns: what's
*always true*, which *states/modes* exist, which *events* it reacts to, which
*optional features* exist, and what can *go wrong*. Use the question banks in
`references/elicitation.md`. Capture raw answers first; formalize afterward.

### 3. Draft in EARS
Convert each captured behavior into the correct pattern using the decision list above.
Write one requirement per statement (atomic — no hidden "and"/"or"). Make the response
measurable. Assign each a stable ID.

### 4. Review and refine
Run every draft requirement through the quality checklist and anti-pattern list in
`references/quality-and-review.md`. Fix vagueness, remove design detail, split compound
statements, de-duplicate, and confirm each is verifiable.

### 5. Document
Emit the requirement set using the structure in `assets/requirements-spec-template.md`
(or fold it into whatever document the user is producing). Group by system/feature,
keep IDs stable, and include the glossary and any assumptions.

## Output conventions

- **IDs**: give every requirement a stable identifier, e.g. `REQ-PAY-014` or `EARS-012`.
  Never renumber existing IDs when inserting new ones — append.
- **Rationale (optional but recommended)**: a one-line "why" beneath a requirement is
  not part of the EARS sentence but greatly helps reviewers and testers.
- **One sentence, one requirement.** If you wrote "and then" or "as well as", split it.
- **Present a table or numbered list**, each row an atomic EARS statement, unless the
  user asked for a full document — then use the template.

## Reference files

Read the relevant file when you need depth; you don't need all three for every task:

- `references/patterns.md` — Full definitions of all five patterns + complex/nested
  requirements, keyword-ordering rules, and 25+ worked examples across domains. Read
  this whenever you're authoring or classifying and want the authoritative form.
- `references/elicitation.md` — How to *gather* requirements: techniques, per-capability
  question banks organized by EARS dimension, and how to interrogate an existing doc or
  transcript. Read this at the start of a gathering session.
- `references/quality-and-review.md` — Quality rules, the full anti-pattern catalogue
  with before/after fixes, a review checklist, testability/BDD mapping, and how EARS
  aligns with ISO/IEC/IEEE 29148 requirement characteristics. Read this before you
  finalize or when asked to critique requirements.

Template:
- `assets/requirements-spec-template.md` — A ready-to-fill requirements/SRS document
  skeleton with the EARS sections wired in.
