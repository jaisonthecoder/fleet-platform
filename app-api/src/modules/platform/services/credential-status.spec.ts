import { credentialField, credentialStatusFor } from './access.service';

/** Returns an ISO date-only string offset from today by `days`. */
function isoDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('credential status', () => {
  it('classifies expiry into Valid / ExpiringSoon / Expired', () => {
    expect(credentialStatusFor(isoDate(40))).toBe('Valid');
    expect(credentialStatusFor(isoDate(10))).toBe('ExpiringSoon');
    expect(credentialStatusFor(isoDate(-1))).toBe('Expired');
  });

  it('reports Missing when number or expiry is absent', () => {
    expect(credentialField(null, isoDate(40), 'manual', false).status).toBe(
      'Missing',
    );
    expect(credentialField('L-1', null, 'manual', false).status).toBe('Missing');
    expect(credentialField(null, null, null, false)).toEqual({
      number: null,
      expiry: null,
      status: 'Missing',
      source: null,
      verified: false,
    });
  });

  it('returns the value + computed status + provenance when present', () => {
    const field = credentialField('L-123', isoDate(40), 'manual', true);
    expect(field).toEqual({
      number: 'L-123',
      expiry: isoDate(40),
      status: 'Valid',
      source: 'manual',
      verified: true,
    });
  });
});
