import { z } from 'zod';
import type { StepDecision, WorkflowStatus } from '../modules/workflow/internal/chain';

/** Request to start a multi-step approval chain (FR-WF-01). */
export const startWorkflowSchema = z.object({
  workflowType: z.string().min(1),
  subjectRef: z.string().min(1),
  steps: z
    .array(z.object({ assigneePersonId: z.string().min(1) }))
    .min(1),
  /** SLA per step in minutes; drives timeout escalation. */
  slaMinutes: z.number().int().positive().optional(),
});
export type StartWorkflow = z.infer<typeof startWorkflowSchema>;

/** Request to record a decision on the current step of an instance (FR-WF-02). */
export const decideStepSchema = z.object({
  actorPersonId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED', 'MODIFICATION_REQUESTED']),
  reason: z.string().optional(),
  /** Set when the actor is a delegate deciding on behalf of the assignee (SoD-06). */
  onBehalfOfPersonId: z.string().min(1).optional(),
});
export type DecideStep = z.infer<typeof decideStepSchema>;

/** One step in a workflow view. */
export interface WorkflowStepView {
  sequence: number;
  assigneePersonId: string | null;
  decidedByPersonId: string | null;
  onBehalfOfPersonId: string | null;
  decision: StepDecision | null;
  reason: string | null;
}

/** A workflow instance projection returned to callers/tests. */
export interface WorkflowView {
  id: string;
  workflowType: string;
  subjectRef: string;
  currentStep: number;
  status: WorkflowStatus;
  steps: WorkflowStepView[];
}
