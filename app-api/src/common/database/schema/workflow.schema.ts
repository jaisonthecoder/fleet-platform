import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId } from './_shared';

export const workflowStatusEnum = pgEnum('fleet_workflow_status', [
  'Pending',
  'Approved',
  'Rejected',
  'Escalated',
  'Expired',
  'ModificationRequested',
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
  },
  (t) => [index('workflow_step_instance_idx').on(t.workflowInstanceId, t.sequence)],
);
