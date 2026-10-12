import { z } from 'zod';

import {
  INCOTERMS_2020,
  SEA_ONLY_INCOTERMS,
  TRANSPORT_MODES,
} from '../enums';

/**
 * Validation shared by the API and the SPA form.
 *
 * One schema means the browser and the server reject exactly the same payloads, so a
 * client-side check is a convenience rather than a second, drifting rulebook.
 */

const unlocode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}[A-Z0-9]{3}$/, 'Must be a 5-character UN/LOCODE, e.g. ESVLC');

/**
 * An empty box in the browser serialises as `null`, because JSON has no `undefined`.
 * Plain `.optional()` refuses it, so one cleared optional field rejected the whole
 * request. Null and undefined both mean "not given"; they are folded to `undefined` so
 * the service sees one absence rather than two.
 *
 * Also folds `NaN`, which is what `Number('')` and `Number('abc')` produce in a numeric
 * input and which `JSON.stringify` turns into `null` on the way out.
 */
const blankable = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === null || (typeof value === 'number' && !Number.isFinite(value)) ? undefined : value),
    schema.optional(),
  );

export const packageLineSchema = z.object({
  /**
   * Stable identity for this line within the request, so a dangerous goods entry
   * can say which cargo it sits in and still be right after a line is reordered
   * or removed. Optional for callers that do not declare dangerous goods; the
   * service assigns one when it is absent.
   */
  lineId: blankable(z.string().trim().min(1).max(64)),
  quantity: z.number().int().positive(),
  packageType: z.string().min(1).max(40),
  lengthCm: blankable(z.number().positive()),
  widthCm: blankable(z.number().positive()),
  heightCm: blankable(z.number().positive()),
  weightKg: z.number().nonnegative(),
  description: blankable(z.string().max(400)),
});

/**
 * Packing groups, plus an explicit "not assigned".
 *
 * `NONE` is a real answer, not a blank. Class 1, self-reactive substances,
 * Division 5.2 and Class 7 are excepted from carrying a packing group at all
 * (49 CFR 172.202(a)(4), mirroring the UN Model Regulations), so the form has to
 * be able to say "this entry has none" distinctly from "nobody filled it in".
 *
 * Safe as a constant, where a carrier list would not be: the UN defines exactly
 * three packing groups and has since the Model Regulations existed. The matching
 * `dg_packing_group` lookup is seeded `system`-owned so an administrator cannot
 * add a fourth and have the server reject it.
 */
export const PACKING_GROUPS = ['I', 'II', 'III', 'NONE'] as const;

/** A proper shipping name ending in n.o.s. must carry a technical name. */
const NOT_OTHERWISE_SPECIFIED = /\bn\.?\s?o\.?\s?s\.?/i;

/**
 * One dangerous goods entry: one UN number in one packaging variant.
 *
 * NOT a dangerous goods declaration. The declaration is the shipper's signed
 * certification - 49 CFR 172.204(d)(1) requires it to be signed by the shipper
 * "or his agent" - and CargoWise owns it. This is the data a pricing specialist
 * needs to price the request and ask a carrier whether it will accept. Nothing
 * validated here authorises transport.
 *
 * WHAT IS REQUIRED, AND WHY THOSE
 *
 * The required set is the basic description the regulations require
 * unconditionally (49 CFR 172.202(a), which mirrors the UN Model Regulations
 * sequence every mode derives from): UN number, proper shipping name, class,
 * total quantity with its unit, and the number and type of packages. A pricer
 * needs the same fields, because class and quantity are what drive segregation,
 * stowage and the surcharge - so the regulatory floor and the commercial need
 * are the same list.
 *
 * The conditional ones are conditional on things we can evaluate WITHOUT a
 * licensed dangerous goods list: the class itself, and the text of the shipping
 * name the customer typed. We never infer a hazard.
 *
 * Everything left optional - EmS code, UN packaging code, subsidiary risks,
 * overpack - is either conditional on something only the regulations can tell us
 * (a subsidiary class is required only "when a corresponding subsidiary hazard
 * label is required") or is not known until the packaging is bought.
 *
 * We deliberately do not check the UN number against a list. We hold no licensed
 * dangerous goods list, and a suggestion the customer reads as validation is
 * worse than no suggestion at all.
 */
export const dangerousGoodsSchema = z
  .object({
    unNumber: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'A UN number is four digits, for example 1263.'),
    /** Class or division against the hazard_class lookup, e.g. 3, 2.1, 5.2. */
    hazardClass: z.string().trim().min(1).max(8),
    properShippingName: z.string().trim().min(1).max(240),
    /** Optional: required only when a subsidiary hazard label is, which we cannot know. */
    subsidiaryRisks: blankable(z.array(z.string().trim().min(1).max(8)).max(4)),
    packingGroup: z.enum(PACKING_GROUPS),
    technicalName: blankable(z.string().trim().max(240)),
    flashpointCelsius: blankable(z.number().min(-273).max(1000)),
    emsCode: blankable(z.string().trim().max(40)),
    isMarinePollutant: blankable(z.boolean()),
    packagingType: z.string().trim().min(1).max(80),
    unPackagingCode: blankable(z.string().trim().max(20)),
    packageCount: z.number().int().positive().max(100_000),
    netQuantityPerPackage: z.number().positive().max(1_000_000),
    quantityUnit: z.string().trim().min(1).max(8),
    transportRegime: blankable(z.string().trim().max(40)),
    isInOverpack: blankable(z.boolean()),
    /**
     * The `lineId`s of the cargo this entry travels in. Required and non-empty:
     * an entry linked to nothing means nobody knows which container holds the
     * hazard, which is exactly the shape of a misdeclaration.
     */
    appliesToLines: z.array(z.string().trim().min(1).max(64)).min(1),
    notes: blankable(z.string().trim().max(2000)),
  })
  .superRefine((entry, ctx) => {
    // Flashpoint, for Class 3 as a primary OR subsidiary hazard. 49 CFR
    // 172.203(i)(2) requires it for water transport when it is 60 C or below -
    // and you cannot know whether it is until you state it.
    const flammableLiquid =
      entry.hazardClass.trim() === '3' || (entry.subsidiaryRisks ?? []).includes('3');
    if (flammableLiquid && entry.flashpointCelsius === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['flashpointCelsius'],
        message: 'A flashpoint is required for a flammable liquid.',
      });
    }

    // Technical name for an n.o.s. entry - 49 CFR 172.203(k). Evaluated against
    // the name the customer typed, never against a list of our own.
    if (
      NOT_OTHERWISE_SPECIFIED.test(entry.properShippingName)
      && (entry.technicalName ?? '').trim() === ''
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['technicalName'],
        message: 'A shipping name ending in n.o.s. needs the technical name of its contents.',
      });
    }
  });

/**
 * Load types that require containers rather than package lines.
 *
 * FTL is here with FCL because a full truck is booked as a unit for the same
 * reason: what is being asked for is the vehicle, not a list of boxes.
 */
export const CONTAINERISED_LOAD_TYPES = ['FCL', 'FTL'] as const;

/**
 * One container type and how many of them.
 *
 * `unitId` shares a namespace with a package line's `lineId`, so a dangerous
 * goods entry can name a container as the cargo it sits in. Not validated
 * against the type's payload - the binding figure is on the individual
 * container's CSC plate, so the form warns and the server does not refuse.
 */
export const equipmentSchema = z.object({
  unitId: z.string().trim().min(1).max(64),
  /** container_type lookup CODE, e.g. '40HC'. Not the label. */
  containerType: z.string().trim().min(1).max(20),
  quantity: z.number().int().positive().max(1000),
  grossWeightPerUnitKg: blankable(z.number().positive().max(1_000_000)),
  notes: blankable(z.string().trim().max(400)),
});

/**
 * Reefer settings. One per request.
 *
 * `setPointCelsius` is required and negative is ordinary - deep frozen runs at
 * -25. The range is wider than any cargo we expect and narrow enough to catch a
 * Fahrenheit value typed into a Celsius field.
 *
 * `toleranceCelsius` allows zero, which is a real answer meaning no tolerance at
 * all, and is different from leaving it unstated.
 */
export const temperatureControlSchema = z.object({
  setPointCelsius: z.number().min(-70).max(40),
  toleranceCelsius: blankable(z.number().min(0).max(30)),
  /** reefer_ventilation lookup code. */
  ventilation: blankable(z.string().trim().max(20)),
  controlledAtmosphere: blankable(z.boolean()),
  preCoolingRequired: blankable(z.boolean()),
  /** reefer_data_logger lookup code. */
  dataLogger: blankable(z.string().trim().max(20)),
  notes: blankable(z.string().trim().max(400)),
});

/**
 * One oversized or heavy piece.
 *
 * Every dimension and the weight are required: a piece described as "long" with
 * no figures cannot be quoted, and lifting equipment is ordered from these.
 */
export const oversizeItemSchema = z.object({
  description: z.string().trim().min(1).max(240),
  lengthCm: z.number().positive().max(100_000),
  widthCm: z.number().positive().max(100_000),
  heightCm: z.number().positive().max(100_000),
  weightKg: z.number().positive().max(1_000_000),
  /** lifting_method lookup code. */
  liftingMethod: blankable(z.string().trim().max(30)),
  notes: blankable(z.string().trim().max(400)),
});

/**
 * Everything this schema accepts is persisted. There is a test that walks the keys and
 * asserts it, because the defect being guarded against is a field that validates, gets
 * used in a calculation, and is then silently dropped.
 *
 * The long tail of the request - special handling flags, customs and value data, parties,
 * remarks - stays in `payload` until a field earns a column by being filtered, sorted or
 * sent to another system.
 */
export const createQuoteSchema = z
  .object({
    /** Optional, and validated against the caller's own group server-side. Never trusted. */
    accountId: blankable(z.string().uuid()),
    mode: z.enum(TRANSPORT_MODES),
    /** load_type lookup code. A different axis from mode; absent for air. */
    loadType: blankable(z.string().trim().max(8)),
    originCode: unlocode,
    destinationCode: unlocode,
    /** What is being shipped. Nothing can be priced without it, so the server
     *  requires it rather than leaving the rule to the request screen. */
    commodity: z.string().trim().min(1).max(200),
    grossWeightKg: z.number().positive().max(1_000_000),
    volumeM3: blankable(z.number().positive().max(100_000)),
    currency: z.string().length(3).toUpperCase().default('EUR'),
    packages: blankable(z.array(packageLineSchema).min(1).max(200)),
    incoterm: blankable(z.enum(INCOTERMS_2020)),
    /** When the cargo is available. Not the requested arrival, not the quote validity. */
    readyDate: blankable(z.coerce.date()),
    customerReference: blankable(z.string().trim().max(60)),
    serviceLevel: blankable(z.string().trim().max(40)),
    notes: blankable(z.string().max(2000)),
    equipment: blankable(z.array(equipmentSchema).max(50)),
    temperatureControl: blankable(temperatureControlSchema),
    oversizeItems: blankable(z.array(oversizeItemSchema).max(100)),
    dangerousGoods: blankable(z.array(dangerousGoodsSchema).max(50)),
    payload: blankable(z.record(z.string(), z.json())),
  })
  .refine(
    (value) =>
      value.incoterm === undefined ||
      value.mode === 'sea' ||
      !SEA_ONLY_INCOTERMS.includes(value.incoterm as (typeof SEA_ONLY_INCOTERMS)[number]),
    {
      path: ['incoterm'],
      message: 'FAS, FOB, CFR and CIF apply to sea and inland waterway transport only.',
    },
  )
  // Every hazard must point at cargo that was actually submitted. Checked here so
  // the browser and the server refuse the same request, and again in the service
  // against what is being written, because only the server's copy is trustworthy.
  .superRefine((value, ctx) => {
    const lines = value.packages ?? [];
    const units = value.equipment ?? [];

    // `latestDeliveryDate` still lives in the payload, but the relationship
    // between the two dates is a business rule and belongs on the server: cargo
    // cannot be delivered before it is ready.
    const latest = value.payload?.latestDeliveryDate;
    if (value.readyDate && typeof latest === 'string' && latest !== '') {
      const parsed = new Date(`${latest}T00:00:00Z`);
      if (!Number.isNaN(parsed.getTime()) && parsed < value.readyDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['payload', 'latestDeliveryDate'],
          message: 'Latest delivery cannot be before the cargo is ready.',
        });
      }
    }

    // Two units sharing an id make `appliesToLines` ambiguous, which is the exact
    // failure the link exists to prevent. Package lines and containers share one
    // namespace, so they are checked together.
    const ids = [...lines.map((line) => line.lineId).filter(Boolean), ...units.map((u) => u.unitId)];
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['packages'],
        message: 'Each cargo line and container needs its own id.',
      });
    }

    // A full-container request without a container describes nothing to price.
    if (
      value.loadType !== undefined
      && CONTAINERISED_LOAD_TYPES.includes(value.loadType as (typeof CONTAINERISED_LOAD_TYPES)[number])
      && units.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['equipment'],
        message: 'A full-load request needs at least one container.',
      });
    }

    const entries = value.dangerousGoods ?? [];
    if (entries.length === 0) return;

    const known = new Set(ids);
    entries.forEach((entry, index) => {
      entry.appliesToLines.forEach((lineId) => {
        if (!known.has(lineId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['dangerousGoods', index, 'appliesToLines'],
            message: 'Each dangerous goods entry must name cargo from this request.',
          });
        }
      });
    });
  });

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type PackageLine = z.infer<typeof packageLineSchema>;
