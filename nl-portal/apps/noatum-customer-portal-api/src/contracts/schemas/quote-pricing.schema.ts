import { z } from 'zod';

/**
 * Manual pricing. C4.
 *
 * The design instruction is that it must feel like typing into Excel, so almost
 * everything is optional and nothing is validated against a catalogue. There is no
 * rate table, no tariff and no charge-code list to check against - a schema that
 * demanded one would be inventing a standard the business has said it does not have.
 *
 * What IS enforced is arithmetic and internal consistency: currencies that agree,
 * positions that do not collide, one recommendation, and an answer of some kind.
 */

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter currency code, e.g. EUR');

/** Minor units throughout. A price that round-trips through a float is a price that changes. */
const minorUnits = z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000);

/**
 * An empty box in the browser is `null`, not `undefined` - JSON has no `undefined`, so a
 * cleared input serialises as null. Plain `.optional()` refuses it, which made a blank
 * optional field reject the whole price.
 *
 * Null and undefined both mean "not given" here. They are folded to `undefined` so the
 * rest of the service sees one absence, not two.
 */
const blankable = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullish().transform((value) => value ?? undefined);

/** Same, for a number the person simply left empty. Excel treats a blank cell as zero. */
const blankableNumber = <T extends z.ZodTypeAny>(schema: T, fallback: number) =>
  schema.nullish().transform((value) => value ?? fallback);

export const chargeLineSchema = z.object({
  /** Free text with a hint list in the UI. Never validated against a catalogue. */
  code: blankable(z.string().trim().max(40)),
  description: z.string().trim().min(1).max(240),
  /** "Per container", "Per shipment", "Per B/L". Free text for the same reason. */
  basis: blankable(z.string().trim().max(60)),
  quantity: blankableNumber(z.number().positive().max(1_000_000), 1),
  rateMinorUnits: blankableNumber(minorUnits, 0),
  currency,
  /**
   * Internal cost. Accepted only when the `costCapture` setting is on AND the caller
   * holds `pricing.cost.view`; the service refuses the payload otherwise rather than
   * dropping the field, because silently discarding a number somebody typed is worse
   * than telling them it was not recorded.
   */
  costMinorUnits: blankable(minorUnits),
});

export const quoteOptionSchema = z
  .object({
    name: blankable(z.string().trim().max(120)),
    /** Free text. No carrier catalogue exists. */
    carrierName: blankable(z.string().trim().max(160)),
    serviceRouting: blankable(z.string().trim().max(240)),
    transitDaysMin: blankable(z.number().int().min(0).max(400)),
    transitDaysMax: blankable(z.number().int().min(0).max(400)),
    nextDepartures: blankable(z.string().trim().max(120)),
    freeTimeDays: blankable(z.number().int().min(0).max(365)),
    validUntil: blankable(z.coerce.date()),
    isRecommended: z.boolean().nullish().transform((value) => value ?? false),
    notes: blankable(z.string().trim().max(4000)),
    termsIncluded: blankable(z.string().trim().max(4000)),
    termsExcluded: blankable(z.string().trim().max(4000)),
    termsPayment: blankable(z.string().trim().max(400)),
    termsSubjectTo: blankable(z.string().trim().max(400)),
    // At least one line. A blank option is not a cheaper answer, it is no answer -
    // and publish's "is there an answer" test counts lines, so an empty one would
    // have satisfied it and offered the customer a zero.
    chargeLines: z
      .array(chargeLineSchema)
      .min(1, 'An option needs at least one charge line.')
      .max(100)
      .nullish()
      .transform((value) => value ?? []),
  })
  .refine(
    (option) =>
      option.transitDaysMin === undefined ||
      option.transitDaysMax === undefined ||
      option.transitDaysMin <= option.transitDaysMax,
    { message: 'Transit days from must not exceed transit days to.', path: ['transitDaysMax'] },
  )
  .refine(
    (option) => new Set(option.chargeLines.map((line) => line.currency)).size <= 1,
    {
      message: 'Every charge line on one option must use the same currency.',
      path: ['chargeLines'],
    },
  );

export const priceQuoteSchema = z
  .object({
    options: z.array(quoteOptionSchema).min(1).max(20),
    /**
     * The draft the customer will read. Stored, never sent by this call - the pricing
     * screen labels it "sent only when you confirm", and publishing is a separate act.
     */
    messageToCustomer: blankable(z.string().trim().max(8000)),
  })
  .refine((body) => body.options.filter((option) => option.isRecommended).length <= 1, {
    message: 'Only one option can be recommended.',
    path: ['options'],
  });

export type ChargeLineInput = z.infer<typeof chargeLineSchema>;
export type QuoteOptionInput = z.infer<typeof quoteOptionSchema>;
export type PriceQuoteInput = z.infer<typeof priceQuoteSchema>;
