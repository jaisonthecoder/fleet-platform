import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Honest placeholder for navigation destinations not yet built. */
export function ComingSoonPage() {
  const { t } = useTranslation()

  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardHeader>
        <CardTitle>{t('common.comingSoonTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {t('common.comingSoonBody')}
      </CardContent>
    </Card>
  )
}
