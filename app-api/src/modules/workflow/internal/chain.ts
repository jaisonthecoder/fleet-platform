/**
 * Pure approval-chain state machine. No I/O — the {@link WorkflowService}
 * supplies the current chain shape and a step decision, and this computes the
 * next instance state. Keeping it pure makes the chain rules exhaustively
 * unit-testable independent of the database.
 */

/** Terminal + in-flight states of a workflow instance (mirrors the DB enum). */
export type WorkflowStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Escalated'
  | 'Expired'
  | 'ModificationRequested';

/** A single decision an assignee can record on the current step. */
export type StepDecision = 'APPROVED' | 'REJECTED' | 'MODIFICATION_REQUESTED';

/** The next state of the instance after a decision is applied. */
export interface ChainTransition {
  currentStep: number;
  status: WorkflowStatus;
  /** True when the transition reached a terminal state (Approved/Rejected/ModificationRequested). */
  terminal: boolean;
}

/**
 * Applies a decision to a chain of `totalSteps` at `currentStep` (0-based):
 * - REJECTED at any step short-circuits the whole chain to `Rejected`.
 * - MODIFICATION_REQUESTED returns the request to the raiser
 *   (`ModificationRequested`) — a terminal cycle; the raiser resubmits a fresh
 *   chain (re-consent applies beyond tolerance for bookings).
 * - APPROVED on the last step completes the chain as `Approved`.
 * - APPROVED on an earlier step advances to the next step, still `Pending`.
 */
export function advanceChain(
  totalSteps: number,
  currentStep: number,
  decision: StepDecision,
): ChainTransition {
  if (totalSteps < 1) {
    throw new Error('workflow-chain-empty');
  }
  if (currentStep < 0 || currentStep >= totalSteps) {
    throw new Error('workflow-step-out-of-range');
  }

  if (decision === 'REJECTED') {
    return { currentStep, status: 'Rejected', terminal: true };
  }

  if (decision === 'MODIFICATION_REQUESTED') {
    return { currentStep, status: 'ModificationRequested', terminal: true };
  }

  const isLastStep = currentStep === totalSteps - 1;
  if (isLastStep) {
    return { currentStep, status: 'Approved', terminal: true };
  }

  return { currentStep: currentStep + 1, status: 'Pending', terminal: false };
}

/**
 * No-orphan reroute (FR-WF): a resolved approval chain may contain vacant
 * scopes (a step whose approver seat is empty — vacancy/restructure). Rather
 * than stalling on an orphan step, the vacant steps are dropped so the chain
 * reroutes to the next valid approver up the hierarchy, preserving order.
 * Returns the compacted assignee list. An **empty** result means no valid
 * approver exists anywhere — the caller must escalate to a human (never
 * silently auto-approve).
 */
export function applyNoOrphanReroute(
  assignees: ReadonlyArray<string | null | undefined>,
): string[] {
  return assignees.filter((a): a is string => typeof a === 'string' && a.length > 0);
}
