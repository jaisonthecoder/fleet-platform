import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, Palette } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { SignalCard } from '@/components/ui/signal-card'
import { defaultLanguage } from '@/i18n/config'

/** Branded landing linking to the design system and sample screens. */
export function HomePage() {
  const { t } = useTranslation()
  const { lang } = useParams()
  const base = `/${lang ?? defaultLanguage}`

  const entries = [
    {
      to: `${base}/design`,
      icon: Palette,
      tone: 'signal' as const,
      title: t('home.designTitle'),
      description: t('home.designDescription'),
      action: t('home.designAction'),
    },
    {
      to: `${base}/book-sample`,
      icon: CalendarDays,
      tone: 'brand' as const,
      title: t('home.bookingTitle'),
      description: t('home.bookingDescription'),
      action: t('home.bookingAction'),
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('nav.section')}
        title={t('home.title')}
        description={t('home.subtitle')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => {
          const Icon = entry.icon
          return (
            <SignalCard key={entry.to} tone={entry.tone} className="p-0">
              <Link
                to={entry.to}
                className="flex h-full flex-col gap-2 rounded-xl p-5 transition-colors hover:bg-muted/50"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="size-4.5" />
                </span>
                <span className="mt-1 text-base font-semibold">
                  {entry.title}
                </span>
                <span className="text-sm text-muted-foreground">
                  {entry.description}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                  {entry.action} <ArrowRight className="size-4" />
                </span>
              </Link>
            </SignalCard>
          )
        })}
      </div>
    </div>
  )
}
