import { IntegrationMessageService } from '../../src/integration/messages/integration-message.service';
import type { JobsService } from '../../src/integration/jobs/jobs.service';

export interface RecordedJob {
  name: string;
  payload: Record<string, unknown>;
  identity: { sourceMessageId: string; portalRef: string };
}

/**
 * A JobsService that records instead of enqueueing.
 *
 * Starting pg-boss for every pricing test would be slow and would prove nothing
 * these tests are about. That transactional enqueue really works is covered once,
 * properly, in `job-transaction.spec.ts`; here the question is only whether
 * publishing asks for the right job with the right idempotency identity.
 */
export function recordingJobs(): JobsService & { recorded: RecordedJob[] } {
  const recorded: RecordedJob[] = [];

  return {
    recorded,
    enqueue: async (
      _tx: unknown,
      name: string,
      payload: Record<string, unknown>,
      identity: { sourceMessageId: string; portalRef: string },
    ) => {
      recorded.push({ name, payload, identity });
      return 'recorded';
    },
  } as unknown as JobsService & { recorded: RecordedJob[] };
}

/** The real message service: it writes real rows, which is the point of it. */
export function integrationMessages(): IntegrationMessageService {
  return new IntegrationMessageService();
}
