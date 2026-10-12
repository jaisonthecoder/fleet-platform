# AI implementation

Everything about the AI capability in the customer portal. Start here.

> **Status: demo scaffolding, not a finished feature.**
> Built 22.09.2026 for a management demo. Deliberately throwaway — see
> [02-Build-Status.md](02-Build-Status.md) §6 for exactly what is missing before
> this could face a real customer.

## What exists today

**Built:** one capability, **AI quote intake**. A customer uploads a commercial
invoice, packing list or PO — or pastes an enquiry email — and the quote request
form fills itself as an editable draft. Anything the document does not say, the
assistant asks for.

**Planned, not started:** a **staff pricing assistant** — see
[03-Staff-Pricing-Assistant-Plan.md](03-Staff-Pricing-Assistant-Plan.md), which
also records which proposed capabilities are blocked, and why.

Nothing else AI-related exists. No chatbot, no document classification, no
pricing suggestion.

## Read in this order

| Document | What it answers |
| --- | --- |
| [01-What-We-Are-Building.md](01-What-We-Are-Building.md) | What it does, the one design decision that matters, the rules it applies, and what it must never do |
| [02-Build-Status.md](02-Build-Status.md) | Every file, what is done, what is left, and the exact next steps |
| [03-Staff-Pricing-Assistant-Plan.md](03-Staff-Pricing-Assistant-Plan.md) | **Plan only.** The staff-side assistant: what fits, what is blocked for want of data, and the build order |

## If you are an agent picking this up

Read `02-Build-Status.md` §5 first — it is the resume point, with the three
remaining tasks in order. Then `01-What-We-Are-Building.md` §2, which is the rule
that keeps the feature honest and must not be quietly reversed.

Two things that will save you time:

- The feature is **off** unless `quotations.ai_intake` is switched on from the
  Feature management screen **and** a Gemini key is present in `.env.local`. Two
  gates, both deliberate.
- The whole thing lives in two folders and touches five files elsewhere. Keep it
  that way; the point is that it lifts out in one commit.

## Related, but not this

- `docs/operations/AI-Assistant-Context-and-Memory.md` is about how coding
  assistants manage their context window. Different subject entirely.
