import { identityConfig } from './identity.config';

/**
 * P0-R2-4 guard: the dev-login stand-in must be structurally impossible in
 * uat/production. This invariant runs in CI (jest) and fails the build if the
 * environment gate is ever weakened. Acts as the "CI check rejects dev-login in
 * prod config" gate until real Entra JWT validation replaces the stand-in.
 */
describe('identityConfig — dev-login environment gate (P0-R2-4)', () => {
  const original = process.env;
  afterEach(() => {
    process.env = original;
  });

  const build = () =>
    (
      identityConfig as unknown as () => {
        devLoginEnabled: boolean;
        entraConfigured: boolean;
      }
    )();

  it('enables dev-login by default in local', () => {
    process.env = { ...original, NODE_ENV: 'local', AUTH_DEV_LOGIN: undefined };
    expect(build().devLoginEnabled).toBe(true);
  });

  it('FORCES dev-login OFF in production even when AUTH_DEV_LOGIN=true', () => {
    process.env = { ...original, NODE_ENV: 'production', AUTH_DEV_LOGIN: 'true' };
    expect(build().devLoginEnabled).toBe(false);
  });

  it('FORCES dev-login OFF in uat even when AUTH_DEV_LOGIN=true', () => {
    process.env = { ...original, NODE_ENV: 'uat', AUTH_DEV_LOGIN: 'true' };
    expect(build().devLoginEnabled).toBe(false);
  });

  it('honours an explicit disable in local', () => {
    process.env = { ...original, NODE_ENV: 'local', AUTH_DEV_LOGIN: 'false' };
    expect(build().devLoginEnabled).toBe(false);
  });
});
