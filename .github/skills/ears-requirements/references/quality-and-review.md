# Quality, Anti-Patterns & Review

Use this file when finalizing requirements or when asked to critique an existing set.

Table of contents:
1. The quality rules
2. Anti-pattern catalogue (with before/after fixes)
3. Review checklist
4. Testability: mapping EARS to tests / BDD
5. Alignment with ISO/IEC/IEEE 29148 characteristics
6. Traceability, IDs, and change management

---

## 1. The quality rules

A good EARS requirement is:

- **Atomic** — one requirement, one obligation, one testable response. No hidden
  "and then also…".
- **Necessary** — it constrains a real need; if removing it changes nothing observable,
  cut it.
- **Unambiguous** — exactly one interpretation. No "fast", "user-friendly", "as needed".
- **Measurable / verifiable** — you can devise a pass/fail test from it.
- **Correctly patterned** — the keyword matches the actual nature of the behavior
  (state vs. event vs. feature vs. error).
- **Solution-free** — states *what*, not *how*. It shouldn't dictate a specific
  algorithm, data structure, or vendor unless that genuinely is the requirement.
- **Consistent** — uses the same term for the same concept everywhere (back it with a
  glossary), and names a concrete system as subject.
- **Uniquely identified** — carries a stable ID for traceability.

---

## 2. Anti-pattern catalogue

Each entry: the smell, why it's harmful, and a fix.

**A. Vague / unmeasurable wording**
Words like *fast, quick, easy, robust, user-friendly, efficient, appropriate, seamless,
sufficient, minimal, etc.* have no test.
- ✗ The system shall respond to searches quickly.
- ✓ When a user submits a search, the Search Service shall return results within 500 ms
  for 95% of requests.

**B. Compound requirement (multiple obligations in one)**
A single statement smuggling several requirements via "and", "or", "as well as", "; also".
- ✗ When an order is placed, the system shall charge the card and send a confirmation
  email and reserve inventory.
- ✓ Split into three: `When an order is placed, the Order Service shall authorize the
  payment.` / `When payment is authorized, the Order Service shall reserve the ordered
  inventory.` / `When inventory is reserved, the Order Service shall send an order
  confirmation to the customer.`

**C. Passive voice hiding the actor**
No named subject means no one is accountable and the test target is unclear.
- ✗ The confirmation email will be sent when the order completes.
- ✓ When an order completes, the Notification Service shall send a confirmation email to
  the customer.

**D. Implementation / design leakage**
Specifying *how* over-constrains the solution.
- ✗ The system shall use a Redis sorted set to rank search results.
- ✓ When a user submits a search, the Search Service shall return results ordered by
  relevance score, highest first. *(How to store/rank is a design decision.)*

**E. Wrong keyword — When vs. While**
- ✗ When the door is open, the system shall keep the interior light on. *(This is a
  sustained state, not a momentary trigger.)*
- ✓ While a door is open, the Vehicle Controller shall keep the interior light on.

**F. Missing trigger (phantom event)**
"When appropriate/necessary/needed" is not an event.
- ✗ When necessary, the system shall refresh the cache.
- ✓ When a cached record's age exceeds 60 seconds, the Cache Service shall refresh it on
  the next read.

**G. Forgotten unwanted behavior**
Only the happy path is specified; failure is undefined.
- Add the If/Then counterpart to every event: for the payment example above, add
  `If payment authorization fails, then the Order Service shall reject the order and
  notify the customer of the failure reason.`

**H. `will/should/must/may` instead of `shall`**
Mixed modal verbs make it impossible to tell obligations from suggestions.
- ✗ The system should validate the input.
- ✓ When input is submitted, the Form Service shall validate it against the field schema.
  *(If it truly is only a recommendation, it isn't a requirement — move it to prose.)*

**I. Ubiquitous overreach**
Labeling a conditional behavior as always-on.
- ✗ The system shall display the admin dashboard. *(Only admins, only when logged in.)*
- ✓ While a user with the administrator role is signed in, the Portal shall make the
  admin dashboard available.

**J. Negative/underspecified prohibitions**
- ✗ The system shall not be slow.
- ✓ Either a positive measurable requirement (latency budget) or a specific `shall not`
  with a testable condition, e.g. `The Portal shall not store cardholder PAN in plaintext.`

---

## 3. Review checklist

Run each requirement through this list; run the set through the last four items.

Per requirement:
- [ ] Names a concrete system as the subject (not "it"/"the system" when several exist).
- [ ] Uses `shall` exactly once.
- [ ] Correct EARS pattern for the behavior's true nature.
- [ ] Single, observable, measurable response (no hidden "and"/"or").
- [ ] No vague adjectives; every quantity has units/thresholds.
- [ ] States *what*, not *how* (no gratuitous design detail).
- [ ] Has a stable unique ID.

Per set:
- [ ] Every event-driven (When) requirement has matching unwanted-behavior (If/Then) cases.
- [ ] No duplicate or contradictory requirements.
- [ ] Consistent terminology throughout (glossary exists and is honored).
- [ ] Open questions/assumptions captured explicitly rather than guessed.

---

## 4. Testability: mapping EARS to tests / BDD

EARS requirements convert almost mechanically into test cases and Given/When/Then
scenarios, because the clauses already separate context, trigger, and expected result:

| EARS clause | BDD role | Test role |
|---|---|---|
| `While <state>` / `Where <feature>` | **Given** (context/precondition) | test setup / fixture |
| `When <trigger>` / `If <condition>` | **When** (action/event) | the stimulus under test |
| `shall <response>` | **Then** (expected outcome) | the assertion |

Example — requirement:
> While a checkout is in progress, if the inventory service is unreachable, then the
> Booking Service shall fall back to the last cached stock count.

Becomes:
- **Given** a checkout is in progress
- **When** the inventory service is unreachable
- **Then** the Booking Service uses the last cached stock count

Because the response is measurable, the **Then** is a concrete assertion. A requirement
you *can't* turn into a Then/assertion is a requirement that failed rule "measurable" —
send it back.

---

## 5. Alignment with ISO/IEC/IEEE 29148 characteristics

EARS is a syntax; it complements (doesn't replace) the requirement-quality characteristics
in ISO/IEC/IEEE 29148 and INCOSE guidance. EARS directly helps with several of them:

- **Unambiguous** — the constrained syntax removes structural ambiguity.
- **Singular** — the one-`shall`-per-statement rule enforces it.
- **Verifiable** — the clause structure yields a direct test mapping (section 4).
- **Complete** — the five-dimension elicitation drives out omissions.
- **Appropriate / Implementation-free** — the "what not how" rule keeps design out.
- **Conforming** — every statement follows the same recognizable template.

Characteristics EARS does **not** decide for you (still your job): *necessary, feasible,
correct, consistent across the whole set*. Use the review checklist and stakeholder
validation for those.

---

## 6. Traceability, IDs, and change management

- **Stable IDs.** Assign each requirement a unique, meaningful ID (e.g. `REQ-BOOK-021`).
  Never re-use or renumber an ID — append new ones. IDs are the anchor for traceability
  to tests, design, and code.
- **Trace links.** Ideally each requirement links upward (to the need/user story/goal it
  serves) and downward (to the test(s) that verify it). At minimum, keep the ID stable so
  those links can exist.
- **Rationale.** An optional one-line rationale under a requirement ("why") massively
  aids future reviewers and prevents accidental deletion of load-bearing requirements.
- **Glossary.** Maintain a short glossary of domain terms and system names. Inconsistent
  naming is a top source of ambiguity that EARS syntax alone won't catch.
- **Assumptions/open questions.** Keep a living list. It's better to record "unknown —
  needs stakeholder input" than to invent a plausible-sounding requirement.
