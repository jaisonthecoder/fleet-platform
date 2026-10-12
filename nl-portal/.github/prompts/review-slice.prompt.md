---
mode: agent
description: Review a finished slice against the ten-point checklist, in a fresh context
---

<!--
  Generated from .claude/commands/review-slice.md. Edit that file and re-run the generator,
  so both assistants receive the same instructions.
-->

Review slice **${input:args:slice id, e.g. S1.05}** using the `slice-reviewer` agent, so the review runs in its own
context with no memory of writing the code.

Launch it with the Agent tool, `subagent_type: "slice-reviewer"`, and this task:

> Review slice ${input:args:slice id, e.g. S1.05}. Read `CLAUDE.md`, the slice entry in
> `docs/plans/01-Vertical-Slice-Implementation-Plan.md`, and the diff (`git diff main...HEAD`,
> or the working tree if there is no branch yet). Work through all ten checks in
> `docs/03-Agent-Metaprompt.md` section 4 and report PASS/FAIL with `file:line` evidence
> for each. Finish with the required fixes, highest risk first, and a one-line verdict:
> MERGE or FIX FIRST.

While that runs, run the mechanical checks yourself so the two results can be compared:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

When the agent reports back, relay its findings to me in full — I do not see the agent's
output. Then say plainly whether the two agree. If the checks pass but the reviewer found
tenancy, permission or scope problems, the reviewer wins: the checks cover what can be
automated, not judgement.

Do not fix anything yet. Review only. `/fix-findings` is the next step.
