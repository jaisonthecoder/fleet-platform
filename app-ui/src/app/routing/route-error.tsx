import { useTranslation } from 'react-i18next'
import { useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Route-level error boundary element for React Router (`errorElement`). */
export function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()

  if (import.meta.env.DEV) {
    console.error('Route error', error)
  }

  return (
    <div className="mx-auto mt-10 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t('error.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>{t('error.body')}</p>
          <Button onClick={() => window.location.reload()}>
            {t('error.retry')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
