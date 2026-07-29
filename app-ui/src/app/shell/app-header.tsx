import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  Bell,
  Menu,
  Moon,
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
import i18n, { defaultLanguage, supportedLanguages } from '@/i18n/config'
import { useTheme } from '@/app/providers/theme-provider'
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
import { navItems } from './nav'
import { AppSidebarNav } from './app-sidebar'
import { ScopeSwitcher } from '@/features/platform/components/scope-switcher'
import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/breadcrumb'

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

/** Segment labels that override the default nav/humanized resolution. As an
 * ancestor crumb, `admin` reads as the section ("Administration") rather than
 * the Admin-console page; `onboard` gets a friendly label (no nav entry). */
const SEGMENT_LABEL_KEYS: Record<string, string> = {
  admin: 'nav.groups.administration',
  onboard: 'nav.vehicleOnboarding',
}

/** Title-cases an unknown URL segment as a last-resort label (`off-hire` → `Off Hire`). */
function humanizeSegment(segment: string): string {
  return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Standard, route-driven breadcrumb trail: one crumb per URL path segment (after
 * the `/:lang` prefix). Each ancestor crumb links to its cumulative path when
 * that path is a real, enabled nav destination; the last crumb is the current
 * page (non-link, `aria-current`). Labels resolve from the nav table (i18n),
 * then a small override map, then a humanized fallback. The app name is
 * intentionally omitted — it lives in the sidebar brand lockup.
 */
function useBreadcrumbTrail(): BreadcrumbItem[] {
  const { t } = useTranslation()
  const { lang } = useParams()
  const { pathname } = useLocation()
  const base = `/${lang ?? defaultLanguage}`
  const rest = pathname.startsWith(base)
    ? pathname.slice(base.length).replace(/^\/+/, '')
    : ''

  if (!rest) return [{ label: t('nav.home') }]

  const segments = rest.split('/').filter(Boolean)
  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1
    const cumulative = segments.slice(0, index + 1).join('/')
    const navItem = navItems.find((n) => n.segment === cumulative)
    const overrideKey = SEGMENT_LABEL_KEYS[segment]

    // Ancestor overrides (e.g. `admin` → section) win over the page's own label.
    const label =
      !isLast && overrideKey
        ? t(overrideKey)
        : navItem
          ? t(navItem.labelKey)
          : overrideKey
            ? t(overrideKey)
            : humanizeSegment(segment)

    const to =
      !isLast && navItem && !navItem.disabled
        ? `${base}/${cumulative}`
        : undefined

    return { label, to }
  })
}

/** Fixed global header: breadcrumb + page title, with the action cluster. */
export function AppHeader() {
  const { t } = useTranslation()
  const breadcrumbTrail = useBreadcrumbTrail()
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

        {/* Breadcrumb trail (group › screen). */}
        <Breadcrumb items={breadcrumbTrail} className="hidden md:block" />
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
