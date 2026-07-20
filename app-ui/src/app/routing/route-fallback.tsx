import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Neutral loading indicator shown while a lazy route chunk loads. */
export function RouteFallback() {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      aria-label={t('common.loading')}
      className="flex min-h-64 items-center justify-center"
    >
      <Loader2
        className="size-6 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )
}
