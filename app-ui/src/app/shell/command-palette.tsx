import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { defaultLanguage } from '@/i18n/config'
import { navItems } from './nav'

/** Global ⌘/Ctrl-K command menu — quick navigation to the rail destinations. */
export function CommandPalette() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useParams()
  const base = `/${lang ?? defaultLanguage}`
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const go = (segment: string): void => {
    setOpen(false)
    navigate(segment ? `${base}/${segment}` : base)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} label={t('nav.section')}>
      <CommandInput placeholder={t('common.commandPlaceholder')} />
      <CommandList>
        <CommandEmpty>{t('common.commandEmpty')}</CommandEmpty>
        <CommandGroup heading={t('nav.section')}>
          {navItems
            .filter((item) => !item.disabled)
            .map((item) => (
              <CommandItem
                key={item.segment}
                value={t(item.labelKey)}
                onSelect={() => go(item.segment)}
              >
                <item.icon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                {t(item.labelKey)}
              </CommandItem>
            ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
