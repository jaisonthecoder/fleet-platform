import { z } from 'zod';

/** A single lookup value returned to callers (both languages; client localises). */
export interface LookupValueDto {
  id: string;
  code: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  parentId: string | null;
  sortOrder: number;
  /** Present when the type is requested as a tree (hierarchical / cascading). */
  children?: LookupValueDto[];
}

/** A lookup type (list domain) returned to callers. */
export interface LookupTypeDto {
  id: string;
  code: string;
  labelEn: string;
  labelAr: string;
  /** Self parent-child within this type (e.g. Make → Model). */
  isHierarchical: boolean;
  /** Cross-type parent (dependent/cascading lookup), or null when flat/self-hierarchical. */
  parentTypeId: string | null;
  /** Parent type's stable code (when `parentTypeId` is set), else null. */
  parentTypeCode: string | null;
  /** Parent type's English label (when `parentTypeId` is set), else null. */
  parentTypeLabelEn: string | null;
}

/** A generic paged result envelope for admin list endpoints. */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** A child type of a lookup type (its `parent_type_id` points at that type). */
export interface LookupChildTypeDto {
  code: string;
  labelEn: string;
  labelAr: string;
}

/** Admin: a lookup type with its value counts (management catalogue). */
export interface LookupTypeWithCountDto extends LookupTypeDto {
  descriptionEn: string | null;
  descriptionAr: string | null;
  isSystem: boolean;
  /** Number of active (is_active=true) values under the type. */
  activeCount: number;
  /** Total values under the type, including inactive. */
  totalCount: number;
  /**
   * Types whose `parent_type_id` points at this type (its child TYPES). Drives
   * the "+ Child" affordance and the add-child target-type chooser: a value can
   * take a child in any of these types (or, when `isHierarchical`, its own type).
   */
  childTypes: LookupChildTypeDto[];
}

/** The derived lifecycle status shown in the admin values grid. */
export type LookupValueStatus = 'Active' | 'Retiring' | 'Inactive';

/** Admin: an enriched lookup value row (management grid — includes inactive). */
export interface LookupValueAdminDto extends LookupValueDto {
  isActive: boolean;
  retiring: boolean;
  /** Derived: Inactive (is_active=false) > Retiring (retiring=true) > Active. */
  status: LookupValueStatus;
  /** Parent value's stable code, when this value has a parent (else null). */
  parentCode: string | null;
  /** Parent value's English label, when this value has a parent (else null). */
  parentLabelEn: string | null;
  /** How many domain records reference this value's code (0 when unmapped). */
  usageCount: number;
  /** True when at least one child value exists under this value. */
  hasChildren: boolean;
}

/**
 * Admin: a value that is a child of some other value, enriched with the type it
 * lives in. Returned by the by-value children endpoint so the tree can render
 * cross-type children (e.g. Model values under a Make value) each labelled with
 * their own type, alongside self-nested same-type children.
 */
export interface LookupValueTreeChildDto extends LookupValueAdminDto {
  /** Stable code of the lookup type this child value belongs to. */
  typeCode: string;
  /** English label of the child value's own type (for the small type tag). */
  typeLabelEn: string;
}

/** Admin: create a value under a type. `parentCode` cascades within the same type. */
export const createLookupValueSchema = z.object({
  code: z.string().min(1),
  labelEn: z.string().min(1),
  labelAr: z.string().min(1),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  parentCode: z.string().min(1).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateLookupValue = z.infer<typeof createLookupValueSchema>;

/**
 * Admin: update a value's labels/descriptions/order/active flag (code is
 * immutable). `parentCode` re-parents the value: a non-empty code sets the
 * parent (resolved per the type's parent rules), while `null` / `''` clears it
 * (promotes to top level). Omit `parentCode` to leave the parent unchanged.
 */
export const updateLookupValueSchema = z.object({
  labelEn: z.string().min(1).optional(),
  labelAr: z.string().min(1).optional(),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  parentCode: z.string().nullish(),
  sortOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  retiring: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type UpdateLookupValue = z.infer<typeof updateLookupValueSchema>;

/** Admin: paged/filtered query for a type's values (management grid). */
export const listLookupValuesQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(['Active', 'Retiring', 'Inactive']).optional(),
  parentCode: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(25),
});
export type ListLookupValuesQuery = z.infer<typeof listLookupValuesQuerySchema>;

/**
 * Admin: create a new (non-system) lookup type. A type is EITHER self-
 * hierarchical (`isHierarchical`) OR dependent on a parent type
 * (`parentTypeCode`) OR flat — the two are mutually exclusive.
 */
export const createLookupTypeSchema = z.object({
  code: z.string().min(1),
  labelEn: z.string().min(1),
  labelAr: z.string().min(1),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  isHierarchical: z.boolean().optional(),
  /** Stable code of the parent lookup type (cascading/dependent lookup). */
  parentTypeCode: z.string().min(1).optional(),
});
export type CreateLookupType = z.infer<typeof createLookupTypeSchema>;

/**
 * Admin: update a non-system lookup type. `parentTypeCode` re-points the
 * cross-type parent; `null` / `''` clears it. Omit it to leave unchanged.
 */
export const updateLookupTypeSchema = z.object({
  labelEn: z.string().min(1).optional(),
  labelAr: z.string().min(1).optional(),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  isHierarchical: z.boolean().optional(),
  parentTypeCode: z.string().nullish(),
});
export type UpdateLookupType = z.infer<typeof updateLookupTypeSchema>;

/** Admin: reorder a value one position up or down among its siblings. */
export const reorderSchema = z.object({
  direction: z.enum(['up', 'down']),
});
export type Reorder = z.infer<typeof reorderSchema>;

/** A candidate parent value for a type's parent selector (combobox). */
export interface LookupParentOptionDto {
  code: string;
  labelEn: string;
  labelAr: string;
  /** The lookup type the option belongs to (parent type for cascading, same type for self-hierarchical). */
  typeCode: string;
}

/** Maximum rows a single bulk import may carry (DoS guard). */
export const LOOKUP_IMPORT_MAX_ROWS = 2000;

/** One row of a bulk import for a type's values (upsert keyed by code). */
export const importLookupRowSchema = z.object({
  code: z.string().trim().min(1),
  labelEn: z.string().trim().min(1),
  labelAr: z.string().trim().min(1),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  parentCode: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type ImportLookupRow = z.infer<typeof importLookupRowSchema>;

/** A bulk import request for a type's values. */
export const importLookupSchema = z.object({
  rows: z.array(importLookupRowSchema).min(1).max(LOOKUP_IMPORT_MAX_ROWS),
});
export type ImportLookup = z.infer<typeof importLookupSchema>;

/** Per-row failure detail from a bulk import. */
export interface LookupImportError {
  code: string;
  reason: string;
}

/** Outcome summary of a bulk import. */
export interface LookupImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: LookupImportError[];
}

/** One exported value row (round-trips through import). */
export interface LookupExportRow {
  code: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  parentCode: string | null;
  sortOrder: number;
  isActive: boolean;
  retiring: boolean;
  status: LookupValueStatus;
}
