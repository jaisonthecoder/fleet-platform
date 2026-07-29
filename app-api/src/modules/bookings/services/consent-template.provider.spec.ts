import { GovernedConsentTemplateProvider } from './consent-template.provider';

describe('GovernedConsentTemplateProvider', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('returns the explicit local dummy template only when enabled', async () => {
    process.env.NODE_ENV = 'local';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_ENABLED = 'true';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_VERSION = 'local-dummy-v1';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_EFFECTIVE_AT_UTC = '2026-01-01T00:00:00.000Z';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_EN = 'LOCAL TEST ONLY';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_AR = 'اختبار محلي فقط';

    const template = await new GovernedConsentTemplateProvider().current();

    expect(template).toMatchObject({
      version: 'local-dummy-v1',
      content: { en: 'LOCAL TEST ONLY', ar: 'اختبار محلي فقط' },
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('remains fail-closed in production even when dummy values are present', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_ENABLED = 'true';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_VERSION = 'must-not-load';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_EFFECTIVE_AT_UTC = '2026-01-01T00:00:00.000Z';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_EN = 'forbidden';
    process.env.BOOKING_LOCAL_DUMMY_CONSENT_AR = 'forbidden';

    expect(await new GovernedConsentTemplateProvider().current()).toBeNull();
  });

  it('uses the governed registry in production', async () => {
    process.env.NODE_ENV = 'production';
    const registry = { current: jest.fn().mockResolvedValue({
      version: 'booking-approved-v1', contentHash: 'a'.repeat(64), effectiveAtUtc: '2026-01-01T00:00:00.000Z',
      content: { en: 'Approved English wording', ar: 'صياغة عربية معتمدة' },
    }) };

    expect(await new GovernedConsentTemplateProvider(registry as never).current('org-1')).toMatchObject({ version: 'booking-approved-v1' });
    expect(registry.current).toHaveBeenCalledWith('Booking', 'org-1');
  });

  it('isolates test fixtures from registry state', async () => {
    process.env.NODE_ENV = 'test';
    process.env.BOOKING_TEST_CONSENT_VERSION = 'test-isolated-v1';
    process.env.BOOKING_TEST_CONSENT_EFFECTIVE_AT_UTC = '2026-01-01T00:00:00.000Z';
    process.env.BOOKING_TEST_CONSENT_EN = 'TEST EN';
    process.env.BOOKING_TEST_CONSENT_AR = 'TEST AR';
    const registry = { current: jest.fn().mockResolvedValue({ version: 'must-not-load' }) };

    expect(await new GovernedConsentTemplateProvider(registry as never).current('org-1')).toMatchObject({ version: 'test-isolated-v1' });
    expect(registry.current).not.toHaveBeenCalled();
  });
});