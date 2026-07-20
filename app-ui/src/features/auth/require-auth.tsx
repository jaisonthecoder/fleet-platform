import { type ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { RouteFallback } from '@/app/routing/route-fallback'
import { defaultLanguage } from '@/i18n/config'
import { useAuth } from './auth-context'

/** Gate that requires an authenticated session; else redirects to `/:lang/login`. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const { lang } = useParams()
  const location = useLocation()

  if (status === 'loading') return <RouteFallback />
  if (status !== 'authenticated') {
    const target = encodeURIComponent(location.pathname + location.search)
    return (
      <Navigate
        to={`/${lang ?? defaultLanguage}/login?redirect=${target}`}
        replace
      />
    )
  }
  return <>{children}</>
}
