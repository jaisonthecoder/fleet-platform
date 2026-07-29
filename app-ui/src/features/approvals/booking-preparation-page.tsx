import { CalendarClock, MapPin, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useBookingPreparation } from './use-booking-approvals'

/** Scoped read-only queue of Approved Bookings awaiting the Handover phase. */
export function BookingPreparationPage() {
  const { t, i18n } = useTranslation()
  const preparation = useBookingPreparation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  if (preparation.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">{t('preparation.loading')}</p>
  if (preparation.isError) return <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><h1 className="font-bold">{t('preparation.error')}</h1><Button className="mt-3" variant="secondary" onClick={() => void preparation.refetch()}>{t('common.retry')}</Button></div>
  return <div className="space-y-5"><header><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand">{t('preparation.eyebrow')}</p><h1 className="mt-1 text-[26px] font-bold">{t('preparation.title')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('preparation.subtitle')}</p></header>{preparation.data?.length === 0 ? <div className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t('preparation.empty')}</div> : <div className="grid gap-3">{preparation.data?.map((item) => <article key={item.bookingId} className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><bdi className="font-data font-bold">{item.bookingNumber}</bdi><span className="bg-warning/10 px-2 py-1 text-xs font-bold text-warning">{t('preparation.awaitingHandover')}</span></div><p className="mt-2 font-semibold"><bdi>{item.vehiclePlate}</bdi></p><div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarClock className="size-4" />{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).formatRange(new Date(item.pickupAtUtc),new Date(item.returnAtUtc))}</span><span className="inline-flex items-center gap-1"><MapPin className="size-4" />{item.scopeName ?? t('preparation.scopeUnavailable')}</span></div></div><div className="text-sm text-muted-foreground"><KeyRound className="me-1 inline size-4" />{t('preparation.handoverGuidance')}</div></article>)}</div>}</div>
}