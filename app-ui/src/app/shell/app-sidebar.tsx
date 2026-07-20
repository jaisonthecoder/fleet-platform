import { Link, NavLink, useMatch, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { defaultLanguage } from '@/i18n/config'
import { BrandMark } from '@/components/brand-mark'
import { useSidebar } from '@/app/providers/sidebar-provider'
import { useAuth } from '@/features/auth/auth-context'
import type { Me } from '@/features/auth/auth.contract'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { navFor, NAV_GROUPS, type NavItem } from './nav'

/** Initials (max two) from a full name, for the profile avatar. */
function initialsOf(name: string | undefined | null): string {
  return (
    (name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '—'
  )
}

/** Brand lockup: navy tile + wordmark + kicker (kicker hidden when compact). */
function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation()
  return (
    <a
      href="#main-content"
      aria-label={t('common.appName')}
      className={cn(
        'flex items-center gap-[11px] pb-4 pt-[22px]',
        collapsed ? 'justify-center px-0' : 'px-5',
      )}
    >
      <span className="grid size-[38px] shrink-0 place-items-center rounded-[2px] bg-white/10">
        <BrandMark size={19} variant="rail" />
      </span>
      {collapsed ? null : (
        <span className="min-w-0">
          <span className="block text-[18px] font-bold leading-[1.1] tracking-[-0.015em] text-rail-foreground">
            {t('common.appName')}
          </span>
          <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-rail-muted">
            {t('common.appKicker')}
          </span>
        </span>
      )}
    </a>
  )
}

interface SidebarItemProps {
  item: NavItem
  base: string
  collapsed: boolean
}

/** One nav entry: icon-only tile when compact, icon + label row when expanded. */
function SidebarItem({ item, base, collapsed }: SidebarItemProps) {
  const { t } = useTranslation()
  const { segment, icon: Icon, labelKey, end, disabled } = item
  const label = t(labelKey)
  const to = `${base}/${segment}`
  // Compute active ourselves: a function className breaks under Radix Slot.
  const match = useMatch({ path: to, end: end ?? false })
  const isActive = !!match && !disabled

  if (disabled) {
    const content = (
      <div
        aria-disabled="true"
        className={cn(
          'flex items-center rounded-[2px] text-rail-muted/45',
          collapsed ? 'size-11 justify-center' : 'h-[38px] gap-[11px] px-3',
        )}
      >
        <Icon aria-hidden="true" className="size-[17px] shrink-0" />
        {collapsed ? null : (
          <span className="text-[13.5px] font-semibold">{label}</span>
        )}
      </div>
    )
    if (!collapsed) return content
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  const link = (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center rounded-[2px] transition-colors',
        collapsed ? 'size-11 justify-center' : 'h-[38px] gap-[11px] px-3',
        isActive
          ? 'bg-signal font-bold text-signal-foreground'
          : 'font-semibold text-rail-muted hover:bg-white/10 hover:text-rail-foreground',
      )}
    >
      <Icon aria-hidden="true" className="size-[17px] shrink-0" />
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="text-[13.5px]">{label}</span>
      )}
    </Link>
  )

  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Compact avatar / full profile card — driven by the authenticated principal. */
function SidebarProfile({
  collapsed,
  me,
}: {
  collapsed: boolean
  me: Me | null
}) {
  const name = me?.fullName ?? '—'
  const initials = initialsOf(me?.fullName)
  const subline = me?.grade ?? me?.email ?? ''
  if (collapsed) {
    return (
      <div
        className="grid size-[34px] place-items-center rounded-full bg-signal text-[12.5px] font-bold text-signal-foreground"
        title={name}
      >
        {initials}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2.5 rounded-[3px] border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="grid size-[34px] shrink-0 place-items-center rounded-full bg-signal text-[12.5px] font-bold text-signal-foreground">
        {initials}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-bold text-rail-foreground">
          {name}
        </div>
        {subline ? (
          <div className="truncate text-[11px] text-rail-muted">{subline}</div>
        ) : null}
      </div>
    </div>
  )
}

interface AppSidebarNavProps {
  onNavigate?: () => void
}

/** Mobile off-canvas navigation (always labelled, grouped). Rendered in the header Sheet. */
export function AppSidebarNav({ onNavigate }: AppSidebarNavProps) {
  const { t } = useTranslation()
  const { lang } = useParams()
  const { me } = useAuth()
  const base = `/${lang ?? defaultLanguage}`
  const items = navFor(me)

  return (
    <nav aria-label={t('nav.section')} className="space-y-4">
      {NAV_GROUPS.map((group) => {
        const groupItems = items.filter((item) => item.group === group)
        if (groupItems.length === 0) return null
        return (
          <div key={group} className="space-y-0.5">
            <p className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-3">
              {t(`nav.groups.${group}`)}
            </p>
            {groupItems.map((item) =>
              item.disabled ? (
                <div
                  key={item.segment}
                  aria-disabled="true"
                  title={t(item.labelKey)}
                  className="flex h-[38px] items-center gap-[11px] rounded-[2px] px-3 text-ink-3/55"
                >
                  <item.icon aria-hidden="true" className="size-[17px] shrink-0" />
                  <span className="text-[13.5px] font-semibold">
                    {t(item.labelKey)}
                  </span>
                </div>
              ) : (
                <NavLink
                  key={item.segment}
                  to={`${base}/${item.segment}`}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-[38px] items-center gap-[11px] rounded-[2px] px-3 transition-colors',
                      isActive
                        ? 'bg-brand font-bold text-brand-foreground'
                        : 'font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                    )
                  }
                >
                  <item.icon aria-hidden="true" className="size-[17px] shrink-0" />
                  <span className="text-[13.5px]">{t(item.labelKey)}</span>
                </NavLink>
              ),
            )}
          </div>
        )
      })}
    </nav>
  )
}

/**
 * Fixed desktop sidebar in the Helm layout: warm light surface, brand lockup,
 * a section label, labelled icon nav, and a profile card. Collapses to a
 * compact icon rail; state is persisted and Ctrl/⌘-B toggles it.
 */
export function AppSidebar() {
  const { t } = useTranslation()
  const { lang } = useParams()
  const { me } = useAuth()
  const base = `/${lang ?? defaultLanguage}`
  const { collapsed } = useSidebar()
  const items = navFor(me)

  return (
    <aside
      aria-label={t('nav.section')}
      className={cn(
        'sticky top-0 z-40 hidden h-screen shrink-0 flex-col overflow-hidden border-e border-border bg-rail text-rail-foreground transition-[width] duration-200 ease-out md:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <SidebarBrand collapsed={collapsed} />

      <nav
        aria-label={t('nav.section')}
        className={cn(
          'flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pt-1',
          collapsed ? 'items-center px-2' : 'px-3.5',
        )}
      >
        {NAV_GROUPS.map((group, groupIndex) => {
          const groupItems = items.filter((item) => item.group === group)
          if (groupItems.length === 0) return null
          return (
            <div
              key={group}
              className={cn('flex flex-col gap-0.5', groupIndex > 0 && 'mt-3')}
            >
              {collapsed ? (
                groupIndex > 0 ? (
                  <div className="mx-auto mb-1 h-px w-8 bg-white/15" />
                ) : null
              ) : (
                <p className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-rail-muted">
                  {t(`nav.groups.${group}`)}
                </p>
              )}
              {groupItems.map((item) => (
                <SidebarItem
                  key={item.segment}
                  item={item}
                  base={base}
                  collapsed={collapsed}
                />
              ))}
            </div>
          )
        })}
      </nav>

      <div
        className={cn(
          'mt-auto flex flex-col gap-2.5 p-3.5',
          collapsed && 'items-center p-2',
        )}
      >
        {collapsed ? null : (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-[2px] border border-dashed border-white/20 bg-white/5 px-3 py-2.5 text-[12.5px] font-bold text-rail-muted transition-colors hover:bg-white/10 hover:text-rail-foreground"
          >
            <Smartphone aria-hidden="true" className="size-[15px]" />
            {t('common.viewMobileApp')}
          </button>
        )}

        <SidebarProfile collapsed={collapsed} me={me} />
      </div>
    </aside>
  )
}
