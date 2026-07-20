import { advanceChain, applyNoOrphanReroute } from './chain';

describe('advanceChain', () => {
  it('advances to the next step on approval of a non-final step', () => {
    const next = advanceChain(2, 0, 'APPROVED');
    expect(next).toEqual({ currentStep: 1, status: 'Pending', terminal: false });
  });

  it('completes the chain on approval of the final step', () => {
    const next = advanceChain(2, 1, 'APPROVED');
    expect(next).toEqual({ currentStep: 1, status: 'Approved', terminal: true });
  });

  it('short-circuits to Rejected on rejection at any step', () => {
    expect(advanceChain(3, 0, 'REJECTED')).toEqual({
      currentStep: 0,
      status: 'Rejected',
      terminal: true,
    });
    expect(advanceChain(3, 2, 'REJECTED')).toEqual({
      currentStep: 2,
      status: 'Rejected',
      terminal: true,
    });
  });

  it('approves a single-step chain immediately', () => {
    expect(advanceChain(1, 0, 'APPROVED')).toEqual({
      currentStep: 0,
      status: 'Approved',
      terminal: true,
    });
  });

  it('rejects malformed input', () => {
    expect(() => advanceChain(0, 0, 'APPROVED')).toThrow('workflow-chain-empty');
    expect(() => advanceChain(2, 2, 'APPROVED')).toThrow('workflow-step-out-of-range');
    expect(() => advanceChain(2, -1, 'APPROVED')).toThrow('workflow-step-out-of-range');
  });

  it('returns the request to the raiser on MODIFICATION_REQUESTED (terminal cycle)', () => {
    expect(advanceChain(3, 1, 'MODIFICATION_REQUESTED')).toEqual({
      currentStep: 1,
      status: 'ModificationRequested',
      terminal: true,
    });
  });
});

describe('applyNoOrphanReroute', () => {
  it('drops vacant steps so the chain reroutes to the next valid approver', () => {
    expect(applyNoOrphanReroute(['p1', null, 'p3'])).toEqual(['p1', 'p3']);
    expect(applyNoOrphanReroute([null, 'p2', undefined, ''])).toEqual(['p2']);
  });

  it('returns empty when no valid approver exists (caller must escalate)', () => {
    expect(applyNoOrphanReroute([null, undefined, ''])).toEqual([]);
  });
});
