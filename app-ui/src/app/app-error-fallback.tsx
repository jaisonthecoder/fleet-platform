import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AppErrorFallbackProps {
  onReset: () => void
}

/** Full-screen fallback shown when a render error is caught. */
export function AppErrorFallback({ onReset }: AppErrorFallbackProps) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/35 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('error.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>{t('error.body')}</p>
          <Button onClick={onReset}>{t('error.retry')}</Button>
        </CardContent>
      </Card>
    </div>
  )
}
