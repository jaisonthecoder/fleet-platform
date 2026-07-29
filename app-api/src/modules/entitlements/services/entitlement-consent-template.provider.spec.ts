import { GovernedEntitlementConsentTemplateProvider } from './entitlement-consent-template.provider';

describe('GovernedEntitlementConsentTemplateProvider', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it('uses the governed Dedicated Vehicle registry in production', async () => {
    process.env.NODE_ENV = 'production';
    const registry = { current: jest.fn().mockResolvedValue({
      version: 'dedicated-approved-v1', contentHash: 'b'.repeat(64), effectiveAtUtc: '2026-01-01T00:00:00.000Z',
      content: { en: 'Approved Dedicated wording', ar: 'صياغة المركبة المخصصة المعتمدة' },
    }) };
    const template = await new GovernedEntitlementConsentTemplateProvider(registry as never).current('org-1');
    expect(template).toMatchObject({ version: 'dedicated-approved-v1' });
    expect(registry.current).toHaveBeenCalledWith('DedicatedVehicle', 'org-1');
  });

  it('isolates test fixtures from registry state', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENTITLEMENT_TEST_CONSENT_VERSION = 'dedicated-test-v1';
    process.env.ENTITLEMENT_TEST_CONSENT_EFFECTIVE_AT_UTC = '2026-01-01T00:00:00.000Z';
    process.env.ENTITLEMENT_TEST_CONSENT_EN = 'TEST EN';
    process.env.ENTITLEMENT_TEST_CONSENT_AR = 'TEST AR';
    const registry = { current: jest.fn().mockResolvedValue({ version: 'must-not-load' }) };
    expect(await new GovernedEntitlementConsentTemplateProvider(registry as never).current('org-1')).toMatchObject({ version: 'dedicated-test-v1' });
    expect(registry.current).not.toHaveBeenCalled();
  });
});
