import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KeyRound, Loader2, LogIn, ShieldCheck } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { defaultLanguage } from '@/i18n/config'
import { ApiRequestError } from '@/lib/api-client'
import { useAuth } from './auth-context'
import { fetchDevUsers, type DevUser } from './auth.contract'

/** Only allow same-app relative redirects (guards against open redirects). */
function isSafeInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?'
  )
}

/** Sign-in: organisation SSO (Entra) + dev-login user picker (with skip fallback). */
export function LoginPage() {
  const { t } = useTranslation()
  const {
    status,
    isSsoConfigured,
    isDevLoginEnabled,
    loginSso,
    loginDev,
    loginSkip,
  } = useAuth()
  const navigate = useNavigate()
  const { lang } = useParams()
  const [searchParams] = useSearchParams()

  const home = `/${lang ?? defaultLanguage}`
  const rawRedirect = searchParams.get('redirect')
  const decoded = rawRedirect ? decodeURIComponent(rawRedirect) : null
  const target = decoded && isSafeInternalPath(decoded) ? decoded : home

  const [devUsers, setDevUsers] = useState<DevUser[] | null>(null)
  const [devUsersFailed, setDevUsersFailed] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Leave the login page once a session exists.
  useEffect(() => {
    if (status === 'authenticated') navigate(target, { replace: true })
  }, [status, target, navigate])

  // Load the seeded users for the dev picker (lower environments only).
  useEffect(() => {
    if (!isDevLoginEnabled) return
    let active = true
    fetchDevUsers()
      .then((users) => {
        if (active) setDevUsers(users)
      })
      .catch(() => {
        if (active) setDevUsersFailed(true)
      })
    return () => {
      active = false
    }
  }, [isDevLoginEnabled])

  async function signInDev(personId: string) {
    setError(null)
    setPending(personId)
    try {
      await loginDev(personId)
      // The status effect navigates to `target` once authenticated.
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.status === 404
          ? t('auth.devUnknownUser')
          : t('auth.devError'),
      )
      setPending(null)
    }
  }

  async function onSso() {
    setError(null)
    setPending('sso')
    try {
      await loginSso()
    } catch {
      setError(t('auth.ssoError'))
      setPending(null)
    }
  }

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div
        role="status"
        aria-label={t('auth.restoring')}
        className="flex min-h-screen items-center justify-center bg-background"
      >
        <Loader2
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    )
  }

  const hasUsers = devUsers !== null && devUsers.length > 0
  const showSkip =
    isDevLoginEnabled &&
    (devUsersFailed || (devUsers !== null && devUsers.length === 0))
  const devLoading = isDevLoginEnabled && devUsers === null && !devUsersFailed

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark size={28} variant="rail" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{t('common.appName')}</p>
            <p className="text-xs opacity-80">{t('common.appKicker')}</p>
          </div>
        </div>
        <div className="max-w-sm space-y-4">
          <h2 className="text-2xl font-bold">{t('common.subtitle')}</h2>
          <ul className="space-y-2 text-sm opacity-90">
            <li className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {t('auth.benefitAccess')}
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {t('auth.benefitAudit')}
            </li>
          </ul>
        </div>
        <p className="text-xs opacity-70">{t('auth.securityNote')}</p>
      </aside>

      {/* Auth panel */}
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center lg:hidden">
            <BrandMark size={28} className="mx-auto" />
            <p className="text-sm font-semibold">{t('common.appName')}</p>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold">{t('auth.welcome')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('auth.subtitle')}
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          {/* SSO card */}
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              {t('auth.ssoCardTitle')}
            </div>
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={!isSsoConfigured || pending === 'sso'}
              onClick={onSso}
            >
              {pending === 'sso' ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <LogIn aria-hidden="true" />
              )}
              {t('auth.sso')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {isSsoConfigured ? t('auth.ssoHint') : t('auth.ssoUnavailable')}
            </p>
          </div>

          {/* Dev-login (lower environments only) */}
          {isDevLoginEnabled ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {t('auth.devTitle')}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('auth.devPick')}
              </p>

              {devLoading ? (
                <div
                  className="flex justify-center py-4"
                  role="status"
                  aria-label={t('common.loading')}
                >
                  <Loader2
                    className="size-5 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              ) : null}

              {hasUsers && devUsers ? (
                <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                  {devUsers.map((user) => (
                    <li key={user.personId}>
                      <button
                        type="button"
                        onClick={() => void signInDev(user.personId)}
                        disabled={pending !== null}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-muted disabled:opacity-60"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {initials(user.fullName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {user.fullName}
                          </span>
                          {user.email ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          ) : null}
                          {user.roles.length > 0 ? (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {user.roles.map((r, i) => (
                                <Badge
                                  key={`${r.role}-${i}`}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {t(`roles.${r.role}`, r.role)}
                                </Badge>
                              ))}
                            </span>
                          ) : null}
                        </span>
                        {pending === user.personId ? (
                          <Loader2
                            className="size-4 shrink-0 animate-spin"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {showSkip ? (
                <div className="space-y-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => loginSkip()}
                  >
                    {t('auth.skip')}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t('auth.skipHint')}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
