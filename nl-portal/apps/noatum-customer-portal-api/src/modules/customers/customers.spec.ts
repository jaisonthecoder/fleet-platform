import { CUSTOMER_TRANSITIONS, canTransition, goLiveReadiness } from '../../contracts/customer.status';

describe('customer lifecycle', () => {
  describe('transitions', () => {
    it.each([
      ['draft', 'onboarding'],
      ['draft', 'active'],
      ['onboarding', 'active'],
      ['active', 'suspended'],
      ['active', 'closed'],
      ['suspended', 'active'],
      ['suspended', 'closed'],
    ] as const)('allows %s to %s', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    it.each([
      ['closed', 'active'],
      ['closed', 'draft'],
      ['draft', 'suspended'],
      ['draft', 'closed'],
      ['onboarding', 'suspended'],
      ['active', 'draft'],
      ['suspended', 'draft'],
    ] as const)('refuses %s to %s', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });

    it('makes closed terminal, so a released code is never quietly re-granted', () => {
      expect(CUSTOMER_TRANSITIONS.closed).toEqual([]);
    });
  });

  describe('go-live readiness', () => {
    const ready = {
      linkedOrganisations: 1,
      invitedAdministrators: 1,
      acceptedAdministrators: 0,
      hasServicingBranch: true,
    };

    it('is ready with an organisation, an invited administrator and a servicing office', () => {
      expect(goLiveReadiness(ready)).toEqual({ ready: true, missing: [] });
    });

    it('refuses without an organisation, and says so', () => {
      expect(goLiveReadiness({ ...ready, linkedOrganisations: 0, acceptedAdministrators: 1 }))
        .toEqual({ ready: false, missing: ['at least one linked organisation'] });
    });

    it('refuses without an invited administrator', () => {
      expect(goLiveReadiness({ ...ready, linkedOrganisations: 2, invitedAdministrators: 0 }))
        .toEqual({ ready: false, missing: ['an invited administrator'] });
    });

    /**
     * The pricing queue finds a quote through the account's servicing branch, or
     * the customer's default when the request names no account. A customer live
     * with neither can submit a request that reaches no queue at all - accepted,
     * acknowledged, and invisible.
     */
    it('refuses without a default servicing office', () => {
      expect(goLiveReadiness({ ...ready, hasServicingBranch: false }))
        .toEqual({ ready: false, missing: ['a default servicing office'] });
    });

    it('lists everything that is missing', () => {
      const result = goLiveReadiness({
        linkedOrganisations: 0,
        invitedAdministrators: 0,
        acceptedAdministrators: 0,
        hasServicingBranch: false,
      });

      expect(result.missing).toEqual([
        'at least one linked organisation',
        'an invited administrator',
        'a default servicing office',
      ]);
    });

    // CO-D01: acceptance is the customer's action. Waiting on it would park a
    // customer half-finished for a reason nobody at Noatum can fix.
    it('does not wait for the invitation to be accepted', () => {
      expect(goLiveReadiness({ ...ready, acceptedAdministrators: 0 }).ready).toBe(true);
    });
  });
});
