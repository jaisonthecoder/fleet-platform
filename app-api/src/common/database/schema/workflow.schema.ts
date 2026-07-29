import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId } from './_shared';
import { person } from './platform.schema';
import { booking } from './booking.schema';

export const workflowStatusEnum = pgEnum('fleet_workflow_status', [
  'Pending',
  'Approved',
  'Rejected',
  'Escalated',
  'Expired',
  'ModificationRequested',
]);

export const workflowDefinition = fleet.table('workflow_definition', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: orgId(),
  workflowType: text('workflow_type').notNull(),
  definitionKey: text('definition_key').notNull(),
  createdByPersonId: uuid('created_by_person_id').references(() => person.id),
  createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('workflow_definition_key_uq').on(t.organizationId, t.workflowType, t.definitionKey)]);

export const workflowDefinitionDeployment = fleet.table('workflow_definition_deployment', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workflowDefinitionId: uuid('workflow_definition_id').notNull().references(() => workflowDefinition.id),
  version: integer('version').notNull(),
  definitionSnapshot: jsonb('definition_snapshot').notNull(),
  definitionSha256: text('definition_sha256').notNull(),
  deployedByPersonId: uuid('deployed_by_person_id').references(() => person.id),
  deployedAtUtc: timestamp('deployed_at_utc', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('workflow_deployment_version_uq').on(t.workflowDefinitionId, t.version),
  uniqueIndex('workflow_deployment_hash_uq').on(t.workflowDefinitionId, t.definitionSha256),
  check('workflow_deployment_version_positive', sql`${t.version} > 0`),
]);

/** One multi-step approval instance (booking, entitlement, …). */
export const workflowInstance = fleet.table(
  'workflow_instance',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    workflowType: text('workflow_type').notNull(),
    subjectRef: text('subject_ref').notNull(),
    currentStep: integer('current_step').notNull().default(0),
    status: workflowStatusEnum('status').notNull().default('Pending'),
    definitionDeploymentId: uuid('definition_deployment_id').references(() => workflowDefinitionDeployment.id),
    stateVersion: integer('state_version').notNull().default(1),
    createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('workflow_instance_subject_idx').on(t.subjectRef)],
);

/** A single step in an approval chain (assignee, decision, delegation, SLA). */
export const workflowStep = fleet.table(
  'workflow_step',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workflowInstanceId: uuid('workflow_instance_id').notNull().references(() => workflowInstance.id),
    sequence: integer('sequence').notNull(),
    assigneePersonId: uuid('assignee_person_id'),
    decidedByPersonId: uuid('decided_by_person_id'),
    onBehalfOfPersonId: uuid('on_behalf_of_person_id'),
    decision: text('decision'),
    reason: text('reason'),
    slaDueAt: timestamp('sla_due_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    stateVersion: integer('state_version').notNull().default(1),
    ownerKind: text('owner_kind'),
    ownerKey: text('owner_key'),
    dueAtUtc: timestamp('due_at_utc', { withTimezone: true }),
    escalatedAtUtc: timestamp('escalated_at_utc', { withTimezone: true }),
  },
  (t) => [
    index('workflow_step_instance_idx').on(t.workflowInstanceId, t.sequence),
    index('workflow_step_owner_due_idx').on(t.ownerKind, t.ownerKey, t.dueAtUtc),
    check('workflow_step_owner_pair', sql`(${t.ownerKind} IS NULL) = (${t.ownerKey} IS NULL)`),
  ],
);

export const bookingApprovalRoute = fleet.table('booking_approval_route', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: orgId(),
  bookingId: uuid('booking_id').notNull().references(() => booking.id),
  workflowInstanceId: uuid('workflow_instance_id').notNull().references(() => workflowInstance.id),
  definitionDeploymentId: uuid('definition_deployment_id').notNull().references(() => workflowDefinitionDeployment.id),
  createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('booking_approval_route_booking_idx').on(t.bookingId, t.createdAtUtc),
  uniqueIndex('booking_approval_route_workflow_uq').on(t.workflowInstanceId),
]);

export const bookingApprovalRouteStep = fleet.table('booking_approval_route_step', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  routeId: uuid('route_id').notNull().references(() => bookingApprovalRoute.id),
  workflowStepId: uuid('workflow_step_id').notNull().references(() => workflowStep.id),
  stepKey: text('step_key').notNull(),
  ordinal: integer('ordinal').notNull(),
  requiredApproverPersonId: uuid('required_approver_person_id').notNull().references(() => person.id),
  assignmentSelectorSnapshot: jsonb('assignment_selector_snapshot').notNull(),
  slaDueAtUtc: timestamp('sla_due_at_utc', { withTimezone: true }),
}, (t) => [
  uniqueIndex('booking_route_step_ordinal_uq').on(t.routeId, t.ordinal),
  uniqueIndex('booking_route_step_key_uq').on(t.routeId, t.stepKey),
  uniqueIndex('booking_route_step_workflow_uq').on(t.workflowStepId),
  check('booking_route_step_ordinal_positive', sql`${t.ordinal} > 0`),
]);

export const workflowDecisionCommand = fleet.table('workflow_decision_command', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: orgId(),
  workflowInstanceId: uuid('workflow_instance_id').notNull().references(() => workflowInstance.id),
  workflowStepId: uuid('workflow_step_id').notNull().references(() => workflowStep.id),
  idempotencyKey: text('idempotency_key').notNull(),
  requestSha256: text('request_sha256').notNull(),
  decision: text('decision').notNull(),
  principalPersonId: uuid('principal_person_id').notNull().references(() => person.id),
  actingForPersonId: uuid('acting_for_person_id').references(() => person.id),
  resultBookingId: uuid('result_booking_id').references(() => booking.id),
  resultBody: jsonb('result_body'),
  createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('workflow_decision_command_key_uq').on(t.organizationId, t.principalPersonId, t.idempotencyKey),
  index('workflow_decision_command_workflow_idx').on(t.workflowInstanceId, t.workflowStepId),
]);
