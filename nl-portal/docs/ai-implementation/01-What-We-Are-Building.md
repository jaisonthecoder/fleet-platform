# What we are building

> Demo scope. Version 1.0 — 22.09.2026.

## 1. The capability

Two ways in, both on the quote request page (`/app/quotations/new`):

- **Upload** a commercial invoice, packing list or purchase order — PDF or image.
- **Paste** the text of an enquiry email, or type a sentence such as
  *"2 pallets of furniture from Qingdao to Valencia, ready next Friday"*.

Gemini reads whichever it gets. The form fills in as an **editable draft**.
Anything it cannot find it asks for, as short questions the customer answers
inline; each answer drops straight into the matching field. The customer checks
everything and submits through the normal path.

## 2. The one design decision that matters

**The model extracts. Our code decides.**

The model is allowed to read a document and report what it says. Every logistics
*rule* — which container the volume implies, what an Incoterm means for the
pickup address, whether cargo is hazardous — runs afterwards in plain TypeScript
against our own lookups.

Three reasons, and the third is why it must not be reversed:

1. **It is explainable.** *"The invoice says 19.2 CBM, and our rule says 15 to 28
   CBM is a twenty-foot container"* is a sentence anyone can check. *"The AI chose
   20GP"* is not.
2. **It is stable.** The same document gives the same draft, because the only
   non-deterministic step is reading text.
3. **A model cannot invent a code that reaches the form.** Container types,
   hazard classes and Incoterms are matched against the lookups before use. An
   unmatched value becomes a question, never a value.

If someone later moves the rules into the prompt "to simplify", all three
properties are lost at once.

## 3. The rules we apply

In `apps/noatum-customer-portal-api/src/modules/ai-intake/intake-rules.ts`.
Pure functions, no I/O.

### Volume to equipment

Containers are chosen from the `container_type` lookup by its recorded
`capacityM3` and `maxPayloadKg`, not from hard-coded codes — so a branch that
adds a 45ft reefer gets it for free.

| Volume | Result |
| --- | --- |
| under 15 m³ | LCL, loose cargo lines, no equipment |
| 15 m³ and over | FCL, smallest container whose capacity at 85% loading holds it |
| more than the largest container | that container, quantity by division, plus a question confirming the split |

**Payload override:** if gross weight exceeds the chosen container's
`maxPayloadKg`, the next container that can carry it is proposed instead, and the
reason is recorded. A box that is volumetrically fine but three tonnes over plate
is the classic intake mistake.

> The 15 m³ threshold came from the requirement note, not from operations.
> Confirm it before anyone treats it as the house rule — it ignores stackability,
> density and pallet footprint, which is why the proposal is always overridable.

### Incoterm to scope

| Term | Origin | Destination |
| --- | --- | --- |
| EXW | seller's premises — pickup address required | port |
| FCA, FAS, FOB, CFR, CIF, CPT, CIP | port | port |
| DAP, DPU, DDP | port | door — delivery address required |

This is the rule the requirement called out: **FOB Keelung means we collect at the
port of Keelung, never the seller's factory street address.**

### Hazard

- A UN number (`UN 3480`) or a stated class is extracted and offered.
- A stated class is matched against the `hazard_class` lookup; unmatched becomes a
  question.
- Keywords — lithium, battery, aerosol, flammable, corrosive — **only raise the
  flag and ask**. They never populate a class. Guessing a class from a product
  name is the shape of a misdeclaration.
- "Requires temperature monitoring" raises the reefer flag with the set point
  left empty and asked for, because an unanswered flag is worse than no flag.

### Questions it always asks

A commercial invoice does not carry a cargo ready date or a delivery postcode, so
these are the normal case rather than a failure: origin, destination, ready date,
commodity, plus whatever the rules above could not settle.

## 4. What it must never do

| Never | Why |
| --- | --- |
| Suggest a price, rate or cost | There is no rate store and no standard quoting process. A number would be invented. |
| Rank, compare or recommend options | Same reason. It describes; it does not advise. |
| Submit the request | A human presses the button. |
| Overwrite a field the customer already typed | The draft fills empty fields only. |
| Take the invoice date as the cargo ready date | Different things. It asks instead. |
| Take the invoice total as a freight price | It is the declared goods value, and only ever reaches `cargoValue`. |
| Produce a dangerous goods declaration | The portal captures DG data for pricing; the signed declaration is the shipper's and CargoWise owns it. |

## 5. Where it sits

```
Customer uploads a PDF, or pastes text
        |
        v
GeminiIntakeClient.extract()        <- the only AI step, reports facts only
        |
        v
intake-rules.ts                     <- deterministic, ours, lookup-backed
        |
        v
IntakeDraft + questions
        |
        v
IntakePanel fills the form; the customer edits and submits as normal
```

Nothing is persisted. No table, no migration. The assistant writes into the
*form*, and the form already knows how to submit.
