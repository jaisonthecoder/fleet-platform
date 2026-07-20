/** A raw source row (arbitrary keys from the uploaded file). */
export type RawRow = Record<string, unknown>;

/** The canonical vehicle fields extracted from a raw row. */
export interface NormalisedRow {
  plate: string | null;
  chassisVin: string | null;
  bodyTypeCode: string | null;
  fuelTypeCode: string | null;
  useCategoryCode: string | null;
  makeCode: string | null;
  modelCode: string | null;
  year: number | null;
  colour: string | null;
}

const str = (v: unknown): string | null => {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number') return String(v);
  return null;
};

/** Reads the first present key (supports camelCase and snake_case source headers). */
const pick = (raw: RawRow, ...keys: string[]): unknown => {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
  }
  return undefined;
};

/** Extracts the canonical vehicle fields from a raw source row. Pure. */
export function normaliseRow(raw: RawRow): NormalisedRow {
  const yearRaw = str(pick(raw, 'year'));
  const year = yearRaw !== null && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : null;
  return {
    plate: str(pick(raw, 'plate', 'Plate', 'plate_number')),
    chassisVin: str(pick(raw, 'chassisVin', 'chassis_vin', 'vin', 'VIN')),
    bodyTypeCode: str(pick(raw, 'bodyTypeCode', 'body_type', 'bodyType')),
    fuelTypeCode: str(pick(raw, 'fuelTypeCode', 'fuel_type', 'fuelType')),
    useCategoryCode: str(pick(raw, 'useCategoryCode', 'use_category', 'useCategory')),
    makeCode: str(pick(raw, 'makeCode', 'make')),
    modelCode: str(pick(raw, 'modelCode', 'model')),
    year,
    colour: str(pick(raw, 'colour', 'color')),
  };
}

/** Verdict of validating a single normalised row's shape (required fields). */
export interface ShapeVerdict {
  ok: boolean;
  reason?: string;
}

/** Validates that the mandatory identity/classification fields are present. */
export function validateRowShape(row: NormalisedRow): ShapeVerdict {
  if (!row.plate) return { ok: false, reason: 'missing-plate' };
  if (!row.chassisVin) return { ok: false, reason: 'missing-chassis-vin' };
  if (!row.bodyTypeCode) return { ok: false, reason: 'missing-body-type' };
  return { ok: true };
}

/** Reference sets used to classify a row (loaded once per batch). */
export interface ClassifyContext {
  bodyTypes: Set<string>;
  fuelTypes: Set<string>;
  useCategories: Set<string>;
  existingPlates: Set<string>;
  existingVins: Set<string>;
  /** Plates/VINs already seen earlier in the same batch (mutated as rows are classified). */
  seenPlates: Set<string>;
  seenVins: Set<string>;
}

/** The classification outcome for a row. */
export interface RowClassification {
  status: 'Valid' | 'Invalid' | 'Duplicate';
  reason: string | null;
  dedup?: { matchType: 'plate' | 'vin'; matchValue: string; existing: boolean };
}

/**
 * Classifies a normalised row: shape → duplicate (within-batch or against the
 * master) → lookup-code validity → Valid. Pure — the caller supplies the
 * reference sets and records the row's plate/VIN into `seen*` afterwards.
 */
export function classifyRow(row: NormalisedRow, ctx: ClassifyContext): RowClassification {
  const shape = validateRowShape(row);
  if (!shape.ok) {
    return { status: 'Invalid', reason: shape.reason ?? 'invalid' };
  }
  if (row.plate && (ctx.seenPlates.has(row.plate) || ctx.existingPlates.has(row.plate))) {
    return {
      status: 'Duplicate',
      reason: 'duplicate-plate',
      dedup: { matchType: 'plate', matchValue: row.plate, existing: ctx.existingPlates.has(row.plate) },
    };
  }
  if (row.chassisVin && (ctx.seenVins.has(row.chassisVin) || ctx.existingVins.has(row.chassisVin))) {
    return {
      status: 'Duplicate',
      reason: 'duplicate-vin',
      dedup: { matchType: 'vin', matchValue: row.chassisVin, existing: ctx.existingVins.has(row.chassisVin) },
    };
  }
  if (row.bodyTypeCode && !ctx.bodyTypes.has(row.bodyTypeCode)) {
    return { status: 'Invalid', reason: `invalid-body-type:${row.bodyTypeCode}` };
  }
  if (row.fuelTypeCode && !ctx.fuelTypes.has(row.fuelTypeCode)) {
    return { status: 'Invalid', reason: `invalid-fuel-type:${row.fuelTypeCode}` };
  }
  if (row.useCategoryCode && !ctx.useCategories.has(row.useCategoryCode)) {
    return { status: 'Invalid', reason: `invalid-use-category:${row.useCategoryCode}` };
  }
  return { status: 'Valid', reason: null };
}

/** Completeness score (valid rows / total) as a 0–100 percentage. */
export function completenessScore(validRows: number, totalRows: number): number {
  if (totalRows <= 0) return 0;
  return Math.round((validRows / totalRows) * 10000) / 100;
}

