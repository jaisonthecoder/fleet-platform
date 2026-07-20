import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';

/**
 * A configurable list's domain (ADR-009). Every org-configurable dropdown /
 * pick-list is a `lookup_type` + its `lookup_value`s — bilingual, code-keyed.
 * Closed structural sets the code depends on stay Postgres enums; everything an
 * admin might reword/extend/localise lives here.
 */
export const lookupType = fleet.table(
  'lookup_type',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    code: text('code').notNull(),
    labelEn: text('label_en').notNull(),
    labelAr: text('label_ar').notNull(),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    /** Allows parent-child values within THIS type (self-cascade, e.g. Make → Model). */
    isHierarchical: boolean('is_hierarchical').notNull().default(false),
    /**
     * Cross-type dependency: values of this type nest under a value of another
     * lookup type (dependent/cascading lookup, e.g. "Vehicle Model" → parent
     * type "Vehicle Make"). Mutually exclusive with `isHierarchical`. Null =
     * this type is flat or self-hierarchical.
     */
    parentTypeId: uuid('parent_type_id').references((): AnyPgColumn => lookupType.id),
    /** Seeded/system type — cannot be deleted (only its values deactivated). */
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('lookup_type_code_uq').on(t.code),
    index('lookup_type_parent_type_idx').on(t.parentTypeId),
  ],
);

/**
 * A value within a lookup type. Bilingual (EN/AR labels + descriptions),
 * optionally parent-child within the same type, effective-dated and soft-state
 * (deactivated / expired, never hard-deleted). Business logic references the
 * stable `code`; labels are display-only (guardrail 1, ADR-009).
 */
export const lookupValue = fleet.table(
  'lookup_value',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    lookupTypeId: uuid('lookup_type_id')
      .notNull()
      .references(() => lookupType.id),
    code: text('code').notNull(),
    labelEn: text('label_en').notNull(),
    labelAr: text('label_ar').notNull(),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    /** Parent value within the same type (cascading choice). */
    parentId: uuid('parent_id').references((): AnyPgColumn => lookupValue.id),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    /** Being phased out: still valid for existing references, hidden from new picks. */
    retiring: boolean('retiring').notNull().default(false),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    metadata: jsonb('metadata'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('lookup_value_type_code_uq').on(t.lookupTypeId, t.code),
    index('lookup_value_type_parent_idx').on(t.lookupTypeId, t.parentId, t.sortOrder),
  ],
);
