# Note — the CargoWise session pack

**16.09.2026 · Jaison Joseph**

Carlos's reply of 16.09.2026 made a fair point: the integration approach should be driven by
the business workflow, not by the technical interfaces. Rather than answer with a list of
endpoints, this pack answers with the workflows themselves, in the exact terms he asked for.

---

## What is in the pack

| File | What it is | Send to Carlos |
| --- | --- | --- |
| `Customer-Portal-Workflows-and-CargoWise-Information-Exchange.md` | **The main document.** Every capability of the portal, every workflow, and for each exchange: what information, who owns it, direction, volume and frequency, whether it is transactional, operational or analytical. Stands alone, no diagrams | **Yes — this is the primary attachment** |
| `Customer-Portal-Workflow-Diagrams.html` | The same workflows as pictures. Open it in any browser; the diagrams draw themselves. Sixteen diagrams, each with one line explaining why it matters | Yes, as a visual companion |
| `Customer-Portal-CargoWise-Integration.drawio.png` | Seven presentation pages of the main diagrams, in brand colours. An editable PNG: it displays as an image anywhere, and still opens in draw.io for editing. Works offline | Optional — useful if the session is run as a presentation |
| `CargoWise-Integration-Requirements.md` | The original message-level shopping list, v1.0, already sent | Already with him |

---

## The three things the pack is designed to achieve

1. **Show that we accepted his argument.** The document is organised around his five
   questions, and the classification of each exchange as transactional, operational or
   analytical is the substance of the reply, not decoration.
2. **Answer his shipment example directly.** The portal does not query CargoWise on a
   customer keystroke; it serves its own synchronised projection. So "all shipments for the
   last year" needs a one-off historical backfill plus a stream of changes — two exchanges
   with two different right answers. His Snowflake extract is a genuine candidate for the
   first one, and the document says so.
3. **Ask for one artefact, not twenty.** One real shipment message with a party block,
   redacted, closes the highest technical risk we carry — whether a party is stored as the
   organisation code or the address code.

---

## Before sending

- **Pilot volume figures are marked "to be confirmed".** Carlos will ask. Fill them in if the
  pilot customer has been chosen and the CargoWise transaction volume is known.
- **Keep two kinds of "owed" separate in the session.** The document-type allow-list and the
  categorised critical-path event list are owed by **Noatum operations**, not by Carlos. We
  already hold the raw catalogues — 479 document types and 664 event codes — so what is
  missing is a business decision, not data.
- The document states what we have already built. That is accurate for the database and the
  code, but nothing has been run against a real CargoWise instance yet; everything to date
  has run against our own simulator. Do not let the session conclude that an integration has
  been tested.

---

## Proposed session agenda

| # | Topic | Minutes |
| --- | --- | --- |
| 1 | Walk the quotation workflow end to end, and agree which CargoWise object each step touches | 30 |
| 2 | Party identification and visibility policy | 20 |
| 3 | Bulk against stream for tracking, documents and finance, including whether Snowflake serves the backfill | 20 |
| 4 | Licensing, transport, authentication, environments | 20 |
| 5 | Actions, owners and dates | 10 |

Offer to bring the portal to the session and show the flows on screen. It changes the tone of
the conversation from a specification review to a working session.
