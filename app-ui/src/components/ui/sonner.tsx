import { useTranslation } from 'react-i18next'
import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/app/providers/theme-provider'
import { directionFor } from '@/i18n/config'

/** App toaster, skinned to Wayfinder tokens and synced to theme + text direction. */
export function Toaster() {
  const { theme } = useTheme()
  const { i18n } = useTranslation()
  const dir = directionFor(i18n.language)

  return (
    <Sonner
      theme={theme}
      dir={dir}
      position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
      toastOptions={{
        classNames: {
          toast:
            'group toast rounded-[3px] border border-border bg-card text-foreground shadow-[var(--shadow-raised)]',
          title: 'text-sm font-semibold',
          description: 'group-[.toast]:text-muted-foreground text-[13px]',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground rounded-[3px] text-xs font-semibold',
          cancelButton:
            'group-[.toast]:bg-secondary group-[.toast]:text-foreground rounded-[3px] text-xs font-semibold',
          closeButton:
            'group-[.toast]:border-border group-[.toast]:bg-card group-[.toast]:text-muted-foreground',
        },
      }}
    />
  )
}
