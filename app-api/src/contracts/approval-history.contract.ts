import { z } from 'zod';

export const approvalInterventionActionSchema = z.enum(['SUSPEND', 'RESUME', 'REVOKE']);
export type ApprovalInterventionAction = z.infer<typeof approvalInterventionActionSchema>;

export const approvalInterventionSchema = z.object({
  action: approvalInterventionActionSchema,
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
}).strict();
export type ApprovalIntervention = z.infer<typeof approvalInterventionSchema>;

export interface ApprovalHistoryItemDto {
  domain: 'PoolBooking' | 'DedicatedVehicle';
  subjectId: string;
  reference: string;
  requesterName: string;
  summary: string;
  status: string;
  revision: number;
  decision: string;
  decisionReason: string | null;
  decidedAtUtc: string;
  suspended: boolean;
  suspensionReason: string | null;
  suspendedAtUtc: string | null;
  capabilities: { suspend: boolean; resume: boolean; revoke: boolean };
  interventions: Array<{ action: ApprovalInterventionAction; reason: string | null; occurredAtUtc: string }>;
}