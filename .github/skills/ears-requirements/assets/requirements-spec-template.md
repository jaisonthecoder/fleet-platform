# <System / Feature Name> — Requirements Specification

- **Document ID:** <e.g. SRS-BOOK-001>
- **Version:** <0.1>
- **Status:** <Draft | In review | Approved>
- **Author(s):** <name(s)>
- **Date:** <YYYY-MM-DD>

---

## 1. Purpose & scope

<One short paragraph: what this system/feature is, what it covers, and what it explicitly
does NOT cover. Name the concrete system(s) whose requirements appear below.>

## 2. Glossary

| Term | Definition |
|---|---|
| <System name> | <the concrete named subject used in requirements> |
| <Domain term> | <precise definition> |

## 3. Actors & external interfaces

<List the users, roles, and external systems/services this system interacts with.>

## 4. Requirements

Requirements are written in EARS. Each is atomic, uses `shall`, and carries a stable ID.
Group by capability/feature. Suggested table format:

### 4.1 <Capability / feature name>

| ID | Requirement (EARS) | Pattern | Rationale (optional) |
|---|---|---|---|
| REQ-XXX-001 | The <system> shall <response>. | Ubiquitous | <why> |
| REQ-XXX-002 | While <state>, the <system> shall <response>. | State-driven | <why> |
| REQ-XXX-003 | When <trigger>, the <system> shall <response>. | Event-driven | <why> |
| REQ-XXX-004 | Where <feature>, the <system> shall <response>. | Optional-feature | <why> |
| REQ-XXX-005 | If <unwanted condition>, then the <system> shall <response>. | Unwanted behavior | <why> |
| REQ-XXX-006 | While <state>, when <trigger>, the <system> shall <response>. | Complex | <why> |

### 4.2 <Next capability / feature name>

| ID | Requirement (EARS) | Pattern | Rationale (optional) |
|---|---|---|---|
| REQ-YYY-001 | … | … | … |

*(Repeat 4.x per capability. For every event-driven requirement, make sure the
corresponding unwanted-behavior (If/Then) cases are also listed.)*

## 5. Non-functional / quality requirements

Written in EARS just like functional ones (often ubiquitous or state-driven). Cover the
relevant attributes: performance, availability, security & privacy, observability,
usability/accessibility, compliance.

| ID | Requirement (EARS) | Attribute |
|---|---|---|
| REQ-NFR-001 | The <system> shall <measurable quality response>. | Performance |
| REQ-NFR-002 | The <system> shall <measurable quality response>. | Security |

## 6. Assumptions & open questions

List anything unresolved. Do not invent requirements to fill these — surface them.

| # | Assumption / open question | Owner | Status |
|---|---|---|---|
| 1 | <e.g. "Timeout for driver matching — confirm exact value"> | <name> | Open |

## 7. Traceability (optional)

| Requirement ID | Source (need / user story / goal) | Verified by (test ID) |
|---|---|---|
| REQ-XXX-001 | <US-12 / goal> | <TC-045> |

---

*Review reminder:* before marking this Approved, run every requirement through the
checklist in `references/quality-and-review.md` — atomic, unambiguous, correctly
patterned, measurable, single `shall`, stable ID, and matching If/Then cases for each
event.
