# ADR-009 — Two permitted inline external calls

| | |
| --- | --- |
| Status | **Accepted** — 19.09.2026 |
| Supersedes | Nothing. Narrows foundation rule 2 by naming its exceptions |
| Related | `CLAUDE.md` foundation rule 2 · [Remediation plan](../plans/Remediation-Plan-Foundation-Gaps.md) R4 · [ADR-008](ADR-008-background-work-queue.md) |

## The rule

Foundation rule 2 says anything that talks to the outside world runs as a job,
enqueued in the same transaction as the business write. It names one exception:
`RateEngineAdapter`, called inline because an instant quote must return inside
30 seconds.

Remediation package R4 was written to close the remaining breaches. Two of them
turn out to be deliberate, and closing them would make the product worse. This
records them as exceptions rather than leaving a foundation rule quietly broken —
a rule with undocumented exceptions stops being a rule.

## Exception 1 — the invitation email

`CustomersService.sendInvitationEmail` calls the email adapter inline.

**Why it stays.** The response tells the operator whether the email was sent, and
returns a single-use invitation link **only when it was not**. That is the
fallback that makes invitations usable while no email transport is configured,
which is the situation today. Move the send to a job and the answer becomes
"queued", so either the operator always gets the link — duplicating a credential
path that email was supposed to own — or never gets it and loses the fallback.

**Why it is safe.** The call is already outside the database transaction and
wrapped so a transport failure degrades to `failed` with the link returned. It
cannot corrupt data, and it cannot lose an invitation: the invitation row is
committed before the email is attempted.

**When to revisit.** When a transport is configured and proven. At that point the
honest design is a job plus a delivery-status column the screen can poll, and the
link stops being part of the response at all.

## Exception 2 — the operator-initiated organisation import

`OrganisationsService` calls `OrganisationImportService.run()` inline from an
HTTP request.

**Why it stays.** The operator is making an authoritative decision — a snapshot
import can deactivate directory rows — and needs the counts back to judge whether
it did what they intended. A job would return "started", which is not an answer to
"is my directory correct now".

**Why it is safe.** It is internal-only, permission-gated on
`admin.organisations.import`, and the safety brake refuses a truncated snapshot
rather than deactivating rows. The scheduled path for the same work now exists and
runs nightly as `master-org.sync`.

**When to revisit.** When a directory is large enough that the request times out.
The seam is already there: the same service backs both paths, so only the
controller changes, plus a run-status screen the operator can watch.

## What this does not permit

Every other external call runs as a job. In particular the CargoWise round trip
does, in both directions — a quote request, a priced quote and a decision are all
recorded in `integration_message` and delivered by the relay. Nothing in a request
path may call CargoWise, and no future exception is implied by this record.

## Consequence

R4 is complete on its own terms once these two are recorded: the scheduler exists,
`quote.expiry` is implemented, retention runs, and `enqueue()` has production
callers. The `cw1.poll` and `cw1.extract.fetch` shapes R4 also listed belong with
the transport that will use them, and are deferred to C2 rather than built blind.
