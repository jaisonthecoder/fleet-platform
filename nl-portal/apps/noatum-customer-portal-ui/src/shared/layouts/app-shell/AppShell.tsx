import './AppShell.css';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Menu, MoreHorizontal } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Tooltip,
} from '@/design-system/components/Controls';
import { cn } from '@/design-system/utils';

export interface ShellNavigationItem {
  id: string;
  label: string;
  mobileLabel?: string;
  icon: ReactNode;
  href?: string;
  group?: string;
  count?: number;
  /**
   * Status of an entry that cannot be opened, for example "Not yet available".
   * Announced and shown on hover rather than printed beside every label, which
   * would repeat the same word down the column and squeeze the labels.
   */
  statusLabel?: string;
  disabled?: boolean;
}

export interface AppShellProps {
  brand: ReactNode;
  utility: ReactNode;
  actions: ReactNode;
  globalSearch?: ReactNode;
  moduleNavigation?: ReactNode;
  context: ReactNode;
  navigation: ShellNavigationItem[];
  mobileNavigationIds?: readonly string[];
  mobileNavigationLabel?: string;
  mobileMenuLabel?: string;
  activeId: string;
  onNavigate: (id: string) => void;
  navigationLabel: string;
  /** Explains the state of any entry the caller marked unavailable. */
  navigationNote?: ReactNode;
  menuLabel: string;
  closeLabel: string;
  skipLabel: string;
  collapseLabel: string;
  expandLabel: string;
  mobileModuleLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  brand,
  utility,
  actions,
  globalSearch,
  moduleNavigation,
  context,
  navigation,
  mobileNavigationIds = [],
  mobileNavigationLabel,
  mobileMenuLabel,
  activeId,
  onNavigate,
  navigationLabel,
  navigationNote,
  menuLabel,
  closeLabel,
  skipLabel,
  collapseLabel,
  expandLabel,
  mobileModuleLabel,
  footer,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const previousPage = useRef(activeId);
  const navigatingFromDrawer = useRef(false);
  const drawerOpener = useRef<HTMLButtonElement | null>(null);
  const drawerId = useId();

  useEffect(() => {
    if (previousPage.current !== activeId) {
      mainRef.current?.scrollTo?.({ top: 0 });
      mainRef.current?.focus({ preventScroll: true });
      previousPage.current = activeId;
    }
  }, [activeId]);

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 1101px)');
    const closeOnDesktop = () => {
      if (media?.matches) setMenuOpen(false);
    };
    media?.addEventListener('change', closeOnDesktop);
    return () => media?.removeEventListener('change', closeOnDesktop);
  }, []);

  const items = (mobile: boolean, bottom = false) =>
    (bottom
      ? mobileNavigationIds.slice(0, 4).flatMap((id) => navigation.filter((item) => item.id === id))
      : navigation
    ).map((item, index) => {
      const select = () => {
        if (mobile && !bottom) {
          navigatingFromDrawer.current = true;
          setMenuOpen(false);
        }
        onNavigate(item.id);
      };
      const displayLabel = bottom ? (item.mobileLabel ?? item.label) : item.label;
      const content = (
        <>
          {item.icon}
          <span className="noa-nav-label">{displayLabel}</span>
          {item.count !== undefined && <span className="noa-nav-count">{item.count}</span>}
        </>
      );
      const suffix = [
        item.count !== undefined ? `(${item.count})` : null,
        !bottom ? (item.statusLabel ?? null) : null,
      ]
        .filter(Boolean)
        .join(' ');
      const attributes = {
        className: cn('noa-nav-item', activeId === item.id && 'noa-nav-active'),
        'aria-current': activeId === item.id ? ('page' as const) : undefined,
        'aria-label': suffix ? `${displayLabel} ${suffix}` : displayLabel,
        title: !bottom && item.statusLabel ? `${displayLabel} - ${item.statusLabel}` : undefined,
      };
      const control =
        item.href && !item.disabled ? (
          <a
            {...attributes}
            href={item.href}
            onClick={(event) => {
              if (
                event.button === 0 &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                select();
              }
            }}
          >
            {content}
          </a>
        ) : (
          // aria-disabled rather than disabled: an unreleased destination stays
          // reachable by keyboard so it can be discovered and announced.
          <button
            {...attributes}
            type="button"
            aria-disabled={item.disabled || undefined}
            onClick={item.disabled ? undefined : select}
          >
            {content}
          </button>
        );
      return (
        <div key={item.id} className="noa-nav-entry">
          {!bottom && item.group && item.group !== navigation[index - 1]?.group && (
            <div className="noa-nav-group">{item.group}</div>
          )}
          {collapsed && !mobile ? <Tooltip label={item.label}>{control}</Tooltip> : control}
        </div>
      );
    });

  return (
    <div className={cn('noa-shell', collapsed && 'noa-shell-collapsed')}>
      <a
        className="noa-skip"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {skipLabel}
      </a>
      <AppHeader
        brand={brand}
        utility={utility}
        actions={actions}
        globalSearch={globalSearch}
        moduleNavigation={moduleNavigation}
        mobileNavigation={
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <button
                className="noa-icon-button"
                aria-label={menuLabel}
                onClick={(event) => {
                  drawerOpener.current = event.currentTarget;
                }}
              >
                <Menu aria-hidden="true" />
              </button>
            </DialogTrigger>
            <DialogContent
              id={drawerId}
              side="left"
              className="noa-mobile-navigation"
              closeLabel={closeLabel}
              aria-describedby={undefined}
              onCloseAutoFocus={(event) => {
                if (navigatingFromDrawer.current) {
                  event.preventDefault();
                  mainRef.current?.focus({ preventScroll: true });
                  navigatingFromDrawer.current = false;
                } else if (drawerOpener.current?.getClientRects().length) {
                  event.preventDefault();
                  drawerOpener.current.focus();
                }
              }}
            >
              <DialogTitle>{navigationLabel}</DialogTitle>
              {moduleNavigation && (
                <div className="noa-mobile-modules" aria-label={mobileModuleLabel}>
                  {moduleNavigation}
                </div>
              )}
              <nav aria-label={navigationLabel}>{items(true)}</nav>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="noa-shell-layout">
        <AppSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          collapseLabel={collapseLabel}
          expandLabel={expandLabel}
          context={context}
          navigationLabel={navigationLabel}
          note={navigationNote}
        >
          {items(false)}
        </AppSidebar>
        <main ref={mainRef} id="main-content" tabIndex={-1} className="noa-main">
          {children}
          {footer && <footer className="noa-app-footer">{footer}</footer>}
        </main>
      </div>
      {mobileNavigationIds.length > 0 && (
        <nav className="noa-bottom-navigation" aria-label={mobileNavigationLabel}>
          {items(true, true)}
          <button
            type="button"
            className="noa-bottom-menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? drawerId : undefined}
            onClick={(event) => {
              drawerOpener.current = event.currentTarget;
              setMenuOpen(true);
            }}
          >
            <MoreHorizontal aria-hidden="true" />
            <span>{mobileMenuLabel ?? menuLabel}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
