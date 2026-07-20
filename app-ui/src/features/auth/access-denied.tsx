import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { defaultLanguage } from '@/i18n/config'
import { useAuth } from './auth-context'
import { resolveLanding } from './landing'
import type { PlatformRole } from './roles'

interface AccessDeniedProps {
  /** The role(s) that would have granted access (shown to the user). */
  requiredRoles?: PlatformRole[]
}

/**
 * 403 screen shown when a signed-in user lacks the role for a route. RBAC is
 * enforced server-side (the API still 403s); this is the friendly UI fallback.
 */
export function AccessDenied({ requiredRoles = [] }: AccessDeniedProps) {
  const { t } = useTranslation()
  const { me } = useAuth()
  const { lang } = useParams()
  const base = `/${lang ?? defaultLanguage}`
  const landing = resolveLanding(me)
  const backTo = landing ? `${base}/${landing}` : base

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center text-center">
      <span className="mb-5 grid size-14 place-items-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
        <ShieldAlert aria-hidden="true" className="size-7" />
      </span>
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        {t('accessDenied.title')}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t('accessDenied.body')}
      </p>
      {requiredRoles.length > 0 ? (
        <div className="mt-5">
          <p className="eyebrow mb-2">{t('accessDenied.requiredRole')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {requiredRoles.map((role) => (
              <StatusChip key={role} tone="warn" label={t(`roles.${role}`)} />
            ))}
          </div>
        </div>
      ) : null}
      <Button asChild variant="secondary" className="mt-7">
        <Link to={backTo}>{t('accessDenied.back')}</Link>
      </Button>
    </div>
  )
}
