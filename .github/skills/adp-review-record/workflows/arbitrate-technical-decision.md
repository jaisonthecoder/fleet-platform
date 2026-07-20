# Workflow: Arbitrate a Cross-Team Technical Decision


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Goal stated in one sentence — what decision needs to be made?
- [ ] The disagreement is real and specific (not "vibes" — name the options).
- [ ] Stakeholders + their concerns identified.
- [ ] Decision deadline named (otherwise this drifts).
- [ ] Right branch.

## Goal
A decision recorded as an ADR, with consequences and a reversal path, made fast enough that the team can move.

## Steps
1. **Frame the decision.** Single sentence: "We need to choose between X, Y, and Z for the purpose of W."
2. **Time-box the input.** 24–72 hours of async input from stakeholders. Anything beyond is procrastination dressed as diligence.
3. **List the options.** Each: shape, cost, latency, risk, reversibility, who needs to learn what.
4. **Apply the criteria.** Use the team's existing tech-radar / standards as priors. Deviating is allowed but goes in the ADR.
5. **Decide.** Pick one. State why the others lose. Document the **strongest argument against** your choice — that's the guard rail for revisit.
6. **Record consequences.** What follows mechanically from this — code, contracts, runbooks, training.
7. **Plan the revisit.** "We'll revisit if X happens or by date Y." Not all decisions are forever; some need an explicit checkpoint.
8. **Communicate the decision.** Once decided, end the debate. People who disagree but commit are gold; people who relitigate slow the team.

## Anti-patterns
- "Let's discuss again next week" three times in a row — paralysis.
- Deciding by consensus on every call — slow, and produces watered-down compromises.
- Choosing without an ADR — the next person re-debates the same thing.
- Reversing the decision the moment someone pushes back — undermines future decisions.

## After you finish
- [ ] DoD met.
- [ ] ADR committed in `/standards/adr/` or repo's ADR folder.
- [ ] Decision communicated in writing to the team.
- [ ] Open questions logged.
- [ ] Notify: `solution-architect`, `governance-lead`, all affected engineers.
- [ ] Risks captured.
- [ ] Notify the downstream role(s): `ai-delivery-planner`, `ai-quality-engineer`.

## Definition of Done
- [ ] Decision named, with chosen option
- [ ] At least 2 alternatives analysed
- [ ] Consequences listed
- [ ] Reversal trigger named
- [ ] ADR committed
- [ ] Communicated to all stakeholders
