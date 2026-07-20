import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId, roleEnum, timestamps } from './_shared';
import { ltree } from './_types';

/** The deployment's organization (dormant-seam anchor; one seeded row in Phase 1). */
export const organization = fleet.table(
  'organization',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    code: text('code').notNull(),
    defaultCurrency: text('default_currency').notNull().default('AED'),
    defaultTimezone: text('default_timezone').notNull().default('Asia/Dubai'),
    revision: integer('revision').notNull().default(1),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('organization_code_uq').on(t.code),
    check('organization_revision_positive', sql`${t.revision} > 0`),
  ],
);

/** Organization-specific hierarchy level taxonomy and display order (max five). */
export const organizationHierarchyLevel = fleet.table(
  'organization_hierarchy_level',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId().references(() => organization.id),
    code: text('code').notNull(),
    position: integer('position').notNull(),
    labelEn: text('label_en').notNull(),
    labelAr: text('label_ar').notNull(),
    mandatory: boolean('mandatory').notNull().default(false),
    active: boolean('active').notNull().default(true),
    revision: integer('revision').notNull().default(1),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('organization_hierarchy_level_org_code_uq').on(
      t.organizationId,
      t.code,
    ),
    uniqueIndex('organization_hierarchy_level_org_position_uq').on(
      t.organizationId,
      t.position,
    ),
    check(
      'organization_hierarchy_level_position_range',
      sql`${t.position} >= 0 AND ${t.position} < 5`,
    ),
    check('organization_hierarchy_level_revision_positive', sql`${t.revision} > 0`),
  ],
);

/** Configurable N-level hierarchy tree (Cluster→Pool→Location for AD Ports). */
export const hierarchyNode = fleet.table(
  'hierarchy_node',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId().references(() => organization.id),
    parentId: uuid('parent_id').references((): AnyPgColumn => hierarchyNode.id),
    /** Stable business identity. Unlike `path`, this never changes on a move. */
    code: text('code').notNull(),
    levelIndex: integer('level_index').notNull(),
    levelLabel: text('level_label').notNull(),
    /** Denormalised `hierarchy-level` lookup code (ADR-009) — kept on the node so
     *  scope/authorization queries never join to resolve depth. */
    levelCode: text('level_code').notNull(),
    name: text('name').notNull(),
    /** Arabic display name (bilingual org tree, ADR-009); `name` is the English name. */
    nameAr: text('name_ar').notNull(),
    path: ltree('path').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    revision: integer('revision').notNull().default(1),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('hierarchy_node_org_code_uq').on(t.organizationId, t.code),
    uniqueIndex('hierarchy_node_org_path_uq').on(t.organizationId, t.path),
    index('hierarchy_node_parent_idx').on(t.parentId),
    index('hierarchy_node_path_idx').using('gist', t.path),
    check('hierarchy_node_level_nonnegative', sql`${t.levelIndex} >= 0`),
    check('hierarchy_node_revision_positive', sql`${t.revision} > 0`),
    check(
      'hierarchy_node_valid_window',
      sql`${t.validTo} IS NULL OR ${t.validTo} > ${t.validFrom}`,
    ),
  ],
);

/** Append-only evidence for hierarchy create/rename/move/retire/reactivate. */
export const hierarchyChangeEvent = fleet.table(
  'hierarchy_change_event',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId().references(() => organization.id),
    nodeId: uuid('node_id').notNull().references(() => hierarchyNode.id),
    action: text('action').notNull(),
    actorRef: text('actor_ref').notNull(),
    reason: text('reason'),
    beforeSnapshot: jsonb('before_snapshot'),
    afterSnapshot: jsonb('after_snapshot'),
    correlationId: text('correlation_id'),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('hierarchy_change_event_node_idx').on(t.nodeId, t.atUtc)],
);

/** Person master (employee / driver / professional driver), synced from HR/HCM. */
export const person = fleet.table(
  'person',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId().references(() => organization.id),
    hcmEmployeeId: text('hcm_employee_id').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    grade: text('grade'),
    employmentStatus: text('employment_status').notNull().default('Active'),
    licenceNumber: text('licence_number'),
    licenceExpiry: date('licence_expiry'),
    lineManagerPersonId: uuid('line_manager_person_id').references((): AnyPgColumn => person.id),
    homePoolNodeId: uuid('home_pool_node_id').references(() => hierarchyNode.id),
    isProfessionalDriver: boolean('is_professional_driver').notNull().default(false),
    sponsor: text('sponsor'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('person_hcm_employee_id_uq').on(t.hcmEmployeeId),
    index('person_line_manager_idx').on(t.lineManagerPersonId),
    index('person_home_pool_node_idx').on(t.homePoolNodeId),
    index('person_licence_expiry_idx').on(t.licenceExpiry),
  ],
);

/** Role assignment scoped to a hierarchy node — backs RBAC and the SoD guard. */
export const roleAssignment = fleet.table(
  'role_assignment',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId().references(() => organization.id),
    personId: uuid('person_id').notNull().references(() => person.id),
    role: roleEnum('role').notNull(),
    scopeNodeId: uuid('scope_node_id').notNull().references(() => hierarchyNode.id),
    /** Provenance of the grant (ADR-009 / 1A₂): manual admin, HCM sync, or Entra group. */
    source: text('source').notNull().default('manual'),
    /** The admin who granted this role (null for system/HCM-sourced grants). */
    assignedByPersonId: uuid('assigned_by_person_id').references((): AnyPgColumn => person.id),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('role_assignment_uq').on(t.personId, t.role, t.scopeNodeId),
    index('role_assignment_person_idx').on(t.personId),
  ],
);

/** Time-boxed delegation of approval authority (one hop). */
export const delegation = fleet.table('delegation', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: orgId().references(() => organization.id),
  delegatorPersonId: uuid('delegator_person_id').notNull().references(() => person.id),
  delegatePersonId: uuid('delegate_person_id').notNull().references(() => person.id),
  requestType: text('request_type').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
  oneHopOnly: boolean('one_hop_only').notNull().default(true),
  ...timestamps(),
});

/** Documented Segregation-of-Duties override (also written to the audit log). */
export const sodException = fleet.table('sod_exception', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: orgId().references(() => organization.id),
  sodRuleCode: text('sod_rule_code').notNull(),
  subjectPersonId: uuid('subject_person_id').notNull().references(() => person.id),
  approverPersonId: uuid('approver_person_id').notNull().references(() => person.id),
  reason: text('reason').notNull(),
  linkedEntityRef: text('linked_entity_ref'),
  createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
});
