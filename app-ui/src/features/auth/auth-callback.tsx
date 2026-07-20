import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { defaultLanguage } from '@/i18n/config'
import { useAuth } from './auth-context'

/**
 * Azure AD redirect landing (`/auth/callback`, registered as the SPA redirect
 * URI). MSAL processes the redirect response in the `AuthProvider` bootstrap;
 * this screen waits for the session to resolve, then routes on: authenticated →
 * app root (which forwards to the role landing), otherwise back to the login page.
 */
export function AuthCallback() {
  const { status } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(`/${defaultLanguage}`, { replace: true })
    } else if (status === 'unauthenticated') {
      navigate(`/${defaultLanguage}/login`, { replace: true })
    }
  }, [status, navigate])

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
