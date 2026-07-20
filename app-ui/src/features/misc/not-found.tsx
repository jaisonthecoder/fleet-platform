import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { defaultLanguage } from '@/i18n/config'

/** 404 page for unknown routes (keeps the active locale prefix). */
export function NotFoundPage() {
  const { t } = useTranslation()
  const { lang } = useParams()

  return (
    <div className="mx-auto mt-10 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t('notFound.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>{t('notFound.body')}</p>
          <Button asChild>
            <Link to={`/${lang ?? defaultLanguage}`}>{t('notFound.back')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
