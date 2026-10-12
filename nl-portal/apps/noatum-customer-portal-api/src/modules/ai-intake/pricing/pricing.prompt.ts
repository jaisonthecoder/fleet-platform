/**
 * What the pricing assistant asks the model for.
 *
 * One job only: read what a carrier actually wrote and report it. It never
 * decides which charges a quote needs, never invents a figure the email does not
 * carry, and never recommends anything - those are `pricing-rules.ts` and the
 * pricer respectively.
 *
 * Kept apart from the intake prompt on purpose. That one reads a customer's
 * commercial invoice; this one reads a carrier's rate reply. Merging them is how
 * an assistant starts answering the wrong question well.
 */

import { asNumber, asText } from '../shared/gemini.client';

/** One charge as the carrier wrote it. */
export interface ObservedCharge {
  code: string | null;
  description: string | null;
  basis: string | null;
  /** Decimal, as printed. Converted to minor units by the editor, never here. */
  rate: number | null;
  currency: string | null;
  quantity: number | null;
}

/** One offer in the reply. A carrier often quotes two services in one email. */
export interface ObservedOffer {
  carrierName: string | null;
  serviceName: string | null;
  serviceRouting: string | null;
  transitDaysMin: number | null;
  transitDaysMax: number | null;
  nextDepartures: string | null;
  freeTimeDays: number | null;
  validUntil: string | null;
  currency: string | null;
  charges: ObservedCharge[];
  notes: string | null;
}

export interface ObservedReply {
  offers: ObservedOffer[];
}

export const REPLY_PROMPT = `You read carrier rate replies for a freight forwarder's pricing desk.

Report ONLY what the message actually says. Return strict JSON in this shape, using
null for anything not stated. Do not guess, do not calculate, do not advise.

{
  "offers": [
    {
      "carrierName": "the carrier or airline named, else null",
      "serviceName": "the service or product name if one is given, e.g. Express",
      "serviceRouting": "routing as written, e.g. direct, or via Singapore",
      "transitDaysMin": number or null,
      "transitDaysMax": number or null,
      "nextDepartures": "sailing or flight dates as written",
      "freeTimeDays": number or null,
      "validUntil": "ISO date the rate is valid until, else null",
      "currency": "ISO currency code for this offer",
      "charges": [
        {
          "code": "the charge code if one is written, e.g. FRT, THC, BAF",
          "description": "what the charge is for, as written",
          "basis": "what it is charged per, e.g. per container, per shipment, per kg",
          "rate": number or null,
          "currency": "ISO code if this line differs from the offer currency",
          "quantity": number or null
        }
      ],
      "notes": "any condition worth passing on, e.g. subject to space"
    }
  ]
}

Rules you must follow:
- One entry in "offers" per distinct service quoted. Two carriers, or one carrier
  offering two services, is two offers.
- Copy every figure exactly as written. Never convert a currency, never total the
  lines, never apply a discount.
- If a rate is not written, return null. A missing rate is correct; an invented
  one is a quote we cannot honour.
- Never add a charge the message does not mention.
- Return the JSON object alone, with no commentary and no code fence.`;

/**
 * The covering note.
 *
 * Re-expression, not judgement: it says back what the pricer already decided, in
 * the customer's own language. The brand voice constraints are in the prompt
 * because a note that arrives with an exclamation mark is not our note.
 */
export const MESSAGE_PROMPT = `You write the covering note that goes out with a freight quotation from
Noatum Logistics, a freight forwarder.

You will be given the request and the options a human pricer has already built.
Write the note that accompanies them. Return strict JSON: {"message": "..."}.

Voice:
- Write as "we" for Noatum and "you" for the customer. Confident, plain, service-led.
- Sentence case. No emoji. No exclamation marks. Dates as DD.MM.YYYY.
- Three short paragraphs at most. No greeting line and no sign-off: the sender adds those.
- Write in the language of the given locale. es-ES means Spanish, anything else means English.

Rules you must follow:
- Mention only what you are given. Never state a price, a total or a currency amount
  that is not in the data, and never compute one.
- Never say which option is better, cheaper or recommended. Describe; do not advise.
- Where dangerous goods or temperature control are present, say plainly that the
  quotation covers them.
- Where a validity date is given, say the quotation holds until that date.
- Do not promise space, equipment or a departure.
- Return the JSON object alone, with no commentary and no code fence.`;

/** Everything the model returns is untyped until this has been over it. */
export function coerceReply(raw: unknown): ObservedReply {  const offers = Array.isArray((raw as { offers?: unknown })?.offers)
    ? ((raw as { offers: unknown[] }).offers)
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];

  return { offers: offers.map(coerceOffer).filter((offer) => offer !== null) };
}

function coerceOffer(raw: unknown): ObservedOffer {
  const record = (raw ?? {}) as Record<string, unknown>;
  const charges = Array.isArray(record.charges) ? record.charges : [];

  return {
    carrierName: asText(record.carrierName),
    serviceName: asText(record.serviceName),
    serviceRouting: asText(record.serviceRouting),
    transitDaysMin: asNumber(record.transitDaysMin),
    transitDaysMax: asNumber(record.transitDaysMax),
    nextDepartures: asText(record.nextDepartures),
    freeTimeDays: asNumber(record.freeTimeDays),
    validUntil: asIsoDate(record.validUntil),
    currency: asCurrency(record.currency),
    charges: charges.map(coerceCharge),
    notes: asText(record.notes),
  };
}

function coerceCharge(raw: unknown): ObservedCharge {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    code: asText(record.code)?.toUpperCase() ?? null,
    description: asText(record.description),
    basis: asText(record.basis),
    rate: asNumber(record.rate),
    currency: asCurrency(record.currency),
    quantity: asNumber(record.quantity),
  };
}

/** Three letters or nothing: a currency the editor cannot resolve is worse than none. */
function asCurrency(value: unknown): string | null {
  const text = asText(value)?.toUpperCase();
  return text && /^[A-Z]{3}$/.test(text) ? text : null;
}

/** Only a real calendar date reaches a validity field. */
function asIsoDate(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : `${match[1]}-${match[2]}-${match[3]}`;
}
