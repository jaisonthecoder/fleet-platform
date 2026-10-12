---
mode: agent
description: Apply reviewer findings in order, one at a time, changing nothing else
---

<!--
  Generated from .claude/commands/fix-findings.md. Edit that file and re-run the generator,
  so both assistants receive the same instructions.
-->

Apply the reviewer findings for slice **${input:args:slice id (then paste the numbered findings)}**, in the order given.

For each finding, in sequence:

1. State the change you are about to make, in one line.
2. Make it.
3. Run the test or check that proves it is fixed.

Rules for this pass, from `docs/03-Agent-Metaprompt.md` section 5:

- **Do not make any other change.** No refactoring you noticed on the way, no renaming,
  no tidying. A fix pass that also improves things is impossible to review.
- If a finding looks wrong, say so and skip it rather than half-applying it. The
  reviewer can be mistaken; silently ignoring it is what cannot happen.
- If a fix needs work outside the slice, stop and tell me. Write it to `docs/gaps.md`.

When finished, run and paste the summary:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Then list each finding with its outcome: fixed (and where), skipped (and why), or
already correct (and the evidence).
