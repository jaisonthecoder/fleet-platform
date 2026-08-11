import { DomainDecisionComparisonRetentionWorker } from './domain-decision-comparison-retention.worker';

describe('DomainDecisionComparisonRetentionWorker', () => {
  it('deletes comparisons older than the configured retention window', async () => {
    const administration = { comparisonOrganizationIds: jest.fn().mockResolvedValue(['org-1']), deleteComparisonsBefore: jest.fn().mockResolvedValue(4) };
    const config = { get: jest.fn().mockReturnValue(30) };
    const worker = new DomainDecisionComparisonRetentionWorker(administration as never, config as never);
    const before = Date.now();
    await worker.run();
    expect(administration.deleteComparisonsBefore.mock.calls[0]?.[0]).toBe('org-1');
    const cutoff = administration.deleteComparisonsBefore.mock.calls[0]?.[1] as Date;
    expect(cutoff.getTime()).toBeLessThanOrEqual(before - 30 * 24 * 60 * 60 * 1000 + 100);
    expect(cutoff.getTime()).toBeGreaterThan(before - 30 * 24 * 60 * 60 * 1000 - 1_000);
  });

  it('contains cleanup failures for the next scheduled run', async () => {
    const administration = { comparisonOrganizationIds: jest.fn().mockResolvedValue(['org-1']), deleteComparisonsBefore: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const worker = new DomainDecisionComparisonRetentionWorker(administration as never, { get: () => 90 } as never);
    await expect(worker.run()).resolves.toBeUndefined();
  });
});