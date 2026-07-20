import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  Bell,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import i18n, { supportedLanguages } from '@/i18n/config'
import { useTheme } from '@/app/providers/theme-provider'
import { useSidebar } from '@/app/providers/sidebar-provider'
import { useAuth } from '@/features/auth/auth-context'
import { BrandMark } from '@/components/brand-mark'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { navItems, type NavGroup } from './nav'
import { AppSidebarNav } from './app-sidebar'
import { ScopeSwitcher } from '@/features/platform/components/scope-switcher'

/** Shared 38×38 bordered icon-button (matches the Helm header controls). */
const ICON_BTN =
  'flex size-[38px] items-center justify-center rounded-[2px] border border-border bg-card text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground [&_svg]:size-[17px]'

/** Switches locale by navigating to the locale-prefixed URL. */
function LanguageToggle() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { lang } = useParams()
  const isArabic = (lang ?? i18n.language).startsWith('ar')
  const nextLang = isArabic ? 'en' : 'ar'
  const nextLabel = isArabic
    ? t('common.switchToEnglish')
    : t('common.switchToArabic')

  const switchLocale = () => {
    const localePrefix = new RegExp(
      `^/(${supportedLanguages.join('|')})(?=/|$)`,
    )
    const rest = location.pathname.replace(localePrefix, '')
    navigate(`/${nextLang}${rest}${location.search}`, { replace: true })
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      aria-label={nextLabel}
      className="flex h-[38px] items-center rounded-[2px] border border-border bg-card px-3 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {nextLabel}
    </button>
  )
}

/** Toggles between light and dark themes. */
function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t('common.toggleTheme')}
      className={ICON_BTN}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </button>
  )
}

/** Register (breadcrumb tier 2) per section; a few destinations override it. */
const REGISTER_BY_GROUP: Record<NavGroup, string> = {
  operations: 'nav.registers.operational',
  governance: 'nav.registers.governance',
  administration: 'nav.registers.administration',
}
const REGISTER_OVERRIDE: Record<string, string> = {
  booking: 'nav.registers.calm',
  console: 'nav.registers.theatrical',
  executive: 'nav.registers.cinematic',
}

/** Resolves the current screen + register from the URL for the breadcrumb. */
function useBreadcrumb(): { register: string | null; screen: string } {
  const { t } = useTranslation()
  const { lang } = useParams()
  const { pathname } = useLocation()
  const prefix = `/${lang ?? ''}`
  const rest = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length).replace(/^\/+/, '')
    : ''

  if (!rest) return { register: null, screen: t('nav.home') }

  // Longest-matching nav segment (handles nested admin/* routes).
  const item = [...navItems]
    .filter((n) => rest === n.segment || rest.startsWith(`${n.segment}/`))
    .sort((a, b) => b.segment.length - a.segment.length)[0]
  if (item) {
    return {
      register: t(
        REGISTER_OVERRIDE[item.segment] ?? REGISTER_BY_GROUP[item.group],
      ),
      screen: t(item.labelKey),
    }
  }

  const first = rest.split('/')[0]
  if (first === 'design')
    return { register: t('nav.registers.reference'), screen: t('nav.design') }
  if (first === 'book-sample')
    return { register: t('nav.registers.calm'), screen: t('nav.bookingSample') }
  return { register: null, screen: t('nav.home') }
}

/** Fixed global header: breadcrumb + page title, with the action cluster. */
export function AppHeader() {
  const { t } = useTranslation()
  const { register, screen } = useBreadcrumb()
  const { collapsed, toggle } = useSidebar()
  const { me, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const displayName = me?.fullName ?? t('common.account')
  const userInitials =
    me?.fullName
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() ?? '—'

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={t('common.openNavigation')}
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle className="text-base font-semibold">
              {t('common.appName')}
            </SheetTitle>
            <SheetDescription className="mb-6 text-sm text-muted-foreground">
              {t('nav.section')}
            </SheetDescription>
            <AppSidebarNav onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Desktop sidebar toggle — always in the same place, easy to find. */}
        <button
          type="button"
          onClick={toggle}
          aria-label={
            collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')
          }
          aria-expanded={!collapsed}
          title={`${collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')} (Ctrl/⌘ B)`}
          className="hidden size-[38px] shrink-0 items-center justify-center rounded-[2px] border border-border bg-card text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground md:flex [&_svg]:size-[17px]"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>

        {/* Brand only shows on mobile — on desktop it lives in the sidebar. */}
        <a
          href="#main-content"
          className="flex shrink-0 items-center gap-2.5 text-foreground md:hidden"
        >
          <BrandMark size={22} />
          <span className="text-[18px] font-bold tracking-tight">
            {t('common.appName')}
          </span>
        </a>

        {/* Breadcrumb eyebrow + page title. */}
        <div className="hidden min-w-0 md:block">
          <div className="truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
            {register ?? t('common.appName')}
          </div>
          <div className="truncate text-[17px] font-bold tracking-[-0.01em] text-foreground">
            {screen}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden md:block">
          <ScopeSwitcher />
        </div>
        <button
          type="button"
          className="hidden h-[38px] items-center gap-2 rounded-[2px] border border-plum/30 bg-plum-tint px-3.5 text-[12.5px] font-bold text-plum transition-colors hover:brightness-95 sm:flex"
        >
          <Sparkles className="size-[15px]" aria-hidden="true" />
          {t('common.askAi')}
        </button>

        <button
          type="button"
          aria-label={t('common.notifications')}
          className={`relative ${ICON_BTN}`}
        >
          <Bell />
          <span className="absolute end-1.5 top-1.5 size-2 rounded-full border-[1.5px] border-card bg-destructive" />
        </button>

        <ThemeToggle />
        <LanguageToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('common.profileMenu')}
              className="grid size-[38px] place-items-center rounded-full bg-brand text-[13px] font-bold text-brand-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {userInitials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel className="leading-tight">
              <div className="truncate">{displayName}</div>
              {me?.email ? (
                <div className="truncate text-xs font-normal text-muted-foreground">
                  {me.email}
                </div>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuItem>{t('common.profile')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => void logout()}
            >
              {t('common.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
