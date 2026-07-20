# Eliciting Requirements for EARS

EARS tells you how to *phrase* a requirement. This file is about *finding* the
requirements in the first place — because the most common and most expensive defect is
**omission**: a behavior nobody wrote down. The trick is to systematically probe the five
EARS dimensions for every capability, so gaps become obvious.

Table of contents:
1. The mindset: five dimensions per capability
2. Techniques for gathering
3. Question banks by EARS dimension
4. Interrogating an existing document, ticket, or transcript
5. From raw answer to EARS statement (worked walk-through)
6. Knowing when you're done

---

## 1. The mindset: five dimensions per capability

For every feature or capability in scope, walk these five questions. Each maps to a
pattern, and together they force the omissions out into the open:

1. **Always true?** → what invariant must hold no matter what? *(ubiquitous)*
2. **States / modes?** → what modes does the system have, and does behavior change in each? *(While)*
3. **Events / triggers?** → what inputs, commands, messages, or thresholds does it react to? *(When)*
4. **Optional features / variants?** → what is present in some configurations but not others? *(Where)*
5. **What can go wrong?** → what errors, faults, timeouts, invalid inputs, or failures must it survive? *(If/Then)*

If you can answer all five for a capability, you have close to complete coverage of it.
Dimension 5 is the one people skip — always ask it explicitly.

---

## 2. Techniques for gathering

Pick the technique that fits how much is already known:

- **Structured interview** — walk the stakeholder through the five dimensions above for
  each capability. Best when you have access to a domain expert.
- **Scenario / use-case walkthrough** — narrate a happy-path scenario end to end, then
  ask "what else could happen at each step?" to surface events and unwanted behavior.
- **Event storming** — brainstorm every domain event first ("payment authorized",
  "seat released"), then attach the system's required response to each. This produces
  event-driven (When) requirements very efficiently.
- **State-model sketch** — draw the system's states/modes; each state prompts While
  requirements, each transition prompts When requirements.
- **Failure-mode probing** — for each external dependency and each input, ask "what if it
  is slow / missing / malformed / unavailable?" to generate If/Then requirements.
- **Existing-artifact mining** — extract latent requirements from a design doc, PRD,
  ticket, email thread, or meeting transcript (see section 4).

Capture answers in plain language first. Do **not** try to write perfect EARS live during
elicitation — it interrupts the flow. Formalize in a second pass.

---

## 3. Question banks by EARS dimension

Ask these per capability. They're phrased for a human stakeholder but work equally well
as prompts to interrogate a document.

**Always true (ubiquitous)**
- What must be true of this system 100% of the time, regardless of what's happening?
- Are there security, safety, privacy, or data-integrity properties that never lapse?
- What legal/compliance obligations always apply?

**States & modes (While)**
- What distinct modes or states can this system/feature be in? (e.g. idle, active,
  degraded, maintenance, over-quota, offline)
- Does behavior differ by state? For each state, what must the system do the whole time
  it's in that state?
- Are there states where certain actions are forbidden or throttled?

**Events & triggers (When)**
- What user actions must the system respond to?
- What incoming messages, API calls, webhooks, or events does it react to?
- What time-based or threshold-based triggers exist? (timers, schedules, limits crossed)
- For each trigger: what exactly must happen, and how fast (measurable response)?

**Optional features & variants (Where)**
- Are there editions, tiers, licenses, plans, or feature flags that change behavior?
- Is there optional hardware, optional modules, or region-specific functionality?
- What behavior exists *only* in some configurations?

**Unwanted behavior (If/Then)**
- What are the failure modes of each dependency (DB, network, third-party API, sensor)?
- What happens on invalid, malformed, out-of-range, or missing input?
- What are the timeout / retry / fallback / degradation rules?
- What must happen on auth failure, permission denial, or quota breach?
- What's the safe/expected behavior when something genuinely unexpected occurs?

**Cross-cutting quality attributes (often ubiquitous or state-driven)**
- Performance: latency/throughput targets? Under what load?
- Availability: uptime targets, degraded-mode behavior?
- Security & privacy: encryption, retention, access control, audit?
- Observability: what must be logged, traced, or alerted on?
- Usability/accessibility: contrast, localization, response-time-to-user?

---

## 4. Interrogating an existing document, ticket, or transcript

When the input is an existing artifact rather than a live stakeholder:

1. **List the actors and systems.** Identify the concrete `<system name>` that each
   requirement will belong to.
2. **Highlight every verb the system performs.** Each is a candidate response.
3. **For each candidate, classify its trigger:** is it always-on, state-scoped,
   event-triggered, feature-gated, or an error case? That classification *is* the pattern.
4. **Flag every vague word** (fast, easy, robust, appropriate, etc.) as an open question —
   it hides a missing measurable criterion. See quality-and-review.md.
5. **Actively look for the missing dimension-5 cases.** Documents describe happy paths;
   the If/Then requirements are almost always absent and must be elicited.
6. **List assumptions and open questions separately.** Don't invent requirements to fill
   gaps — surface the gap for the stakeholder to resolve.

---

## 5. From raw answer to EARS statement (worked walk-through)

Stakeholder says, in a carpool app kickoff:

> "So when someone requests a ride, we match them to a driver going the same way. But if
> no driver's available within a few minutes we should let them know and maybe try again.
> Oh, and premium users get priority matching."

Decompose and formalize:

- Trigger identified ("when someone requests a ride") → **event-driven**:
  `When a rider submits a ride request, the Matching Service shall search for a driver on a compatible route.`
- "within a few minutes" is vague → clarify the number, then an **unwanted-behavior** case:
  `If no compatible driver is found within 3 minutes, then the Matching Service shall notify the rider and re-queue the request.`
- "premium users get priority" is a variant → **optional-feature** (or state, depending
  on how "premium" is modeled):
  `Where a rider holds a premium subscription, the Matching Service shall prioritize that rider's request ahead of standard requests in the queue.`

Three clean, testable requirements out of one sentence — and the act of formalizing
surfaced the vague "few minutes" that needed pinning down.

---

## 6. Knowing when you're done

Coverage heuristics — you've probably captured a capability fully when:
- Every dimension (1–5) has been explicitly asked, even if the answer was "none".
- Every event has both a happy-path (When) response *and* its failure cases (If/Then).
- Every vague adjective has been replaced by a measurable criterion or logged as an open
  question.
- Every requirement names a concrete system and a single, observable response.

Remaining unknowns should live in an explicit "Open questions / assumptions" list, not be
papered over with invented requirements.
