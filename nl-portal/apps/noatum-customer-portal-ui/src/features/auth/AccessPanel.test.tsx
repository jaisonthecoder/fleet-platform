import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessPanel } from './components/AccessPanel';
import { currentUser } from './api/current-user';
import { accessToken, isSignInConfigured, signOut } from '../../auth/sign-in';
import i18n from '../../i18n';
import english from './i18n/en-US.json';
import spanish from './i18n/es-ES.json';

vi.mock('../../auth/sign-in', () => ({
  accessToken: vi.fn(),
  isSignInConfigured: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

const identity = {
  userId: '11111111-1111-4111-8111-111111111111',
  customerGroupId: null,
  isInternal: true,
  onBehalfOfUserId: null,
  accountIds: [],
  permissions: [],
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:43000');
  vi.mocked(isSignInConfigured).mockReturnValue(true);
  vi.mocked(accessToken).mockResolvedValue('test-access-token');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(identity)));
  i18n.addResourceBundle('en-US', 'login', english);
  i18n.addResourceBundle('es-ES', 'login', spanish);
  await i18n.changeLanguage('en-US');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('portal identity access', () => {
  it('shows pending only after the API confirms an account without permissions', async () => {
    render(<AccessPanel audience="staff" />);
    expect(screen.getByRole('heading', { name: english.checkingAccess })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: english.accessPending })).toBeTruthy();
    const request = vi.mocked(fetch).mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('http://localhost:43000/api/me');
    expect(request.headers.get('Authorization')).toBe('Bearer test-access-token');
    expect(request.cache).toBe('no-store');
    expect(request.credentials).toBe('omit');
    expect(request.redirect).toBe('error');
  });

  it.each([401, 403])('denies access on HTTP %s', async (status) => {
    vi.mocked(fetch).mockResolvedValue(respond({}, status));
    render(<AccessPanel audience="customer" />);
    expect(await screen.findByRole('heading', { name: english.accessDenied })).toBeTruthy();
    expect(screen.queryByText(english.accessPending)).toBeNull();
  });

  it('removes confirmed access when a refresh fails, then supports retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond({ ...identity, permissions: ['quotes.read'] }))
      .mockResolvedValueOnce(respond({}, 503)).mockResolvedValueOnce(respond(identity));
    render(<AccessPanel audience="staff" />);
    expect(await screen.findByRole('heading', { name: english.accessConfirmed })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: english.checkAgain }));
    expect(await screen.findByRole('heading', { name: english.accessUnavailable })).toBeTruthy();
    expect(screen.queryByText(english.accessConfirmed)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: english.checkAgain }));
    expect(await screen.findByRole('heading', { name: english.accessPending })).toBeTruthy();
    expect(accessToken).toHaveBeenCalledTimes(3);
  });

  it('requires Microsoft interaction when silent token acquisition fails', async () => {
    vi.mocked(accessToken).mockRejectedValue(new Error('interaction required'));
    render(<AccessPanel audience="staff" />);
    expect(await screen.findByRole('heading', { name: english.signInRequired })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not request tokens or API data with missing configuration', async () => {
    vi.mocked(isSignInConfigured).mockReturnValue(false);
    render(<AccessPanel audience="staff" />);
    expect(screen.getByRole('heading', { name: english.unavailable })).toBeTruthy();
    expect(screen.getByRole('link', { name: english.backToSignIn }).getAttribute('href')).toBe('/login');
    expect(accessToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps sign-out available during API failure and reports logout failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network error'));
    vi.mocked(signOut).mockRejectedValue(new Error('logout failed'));
    render(<AccessPanel audience="staff" />);
    await screen.findByRole('heading', { name: english.accessUnavailable });
    fireEvent.click(screen.getByRole('button', { name: english.signOut }));
    await waitFor(() => expect(signOut).toHaveBeenCalledWith('staff'));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it.each([{}, { permissions: [42] }])('fails closed on an invalid API payload %j', async (body) => {
    vi.mocked(fetch).mockResolvedValue(respond(body));
    await expect(currentUser('staff', new AbortController().signal)).rejects.toMatchObject({ kind: 'accessUnavailable' });
  });

  it('rejects an insecure non-local API origin before sending credentials', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://untrusted.example');
    await expect(currentUser('staff', new AbortController().signal)).rejects.toMatchObject({ kind: 'accessUnavailable' });
    expect(accessToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders Spanish pending access and maintains locale parity', async () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort());
    await i18n.changeLanguage('es-ES');
    render(<AccessPanel audience="staff" />);
    expect(await screen.findByRole('heading', { name: spanish.accessPending })).toBeTruthy();
  });
});
