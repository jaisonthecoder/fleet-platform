import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Menu } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Footer,
  Header,
} from '@/design-system';
import styles from './CustomerShell.module.css';

export interface CustomerNavigationItem {
  id: string;
  label: string;
  href?: string;
  /** Marks a destination that is defined but has not shipped. */
  disabled?: boolean;
  /** Announced and shown on hover, e.g. "Not yet available". */
  statusLabel?: string;
  /**
   * How many records this section holds. Omit it when nobody has answered —
   * a chip drawn on a guess is worse than no chip.
   */
  count?: number;
  /** What the count means, e.g. "12 shipments". Announced, never drawn. */
  countLabel?: string;
}

export interface CustomerShellProps {
  /** Brand lockup content, e.g. NOATUM <small>LOGISTICS</small>. */
  brand: ReactNode;
  /** Where the lockup goes. Defaults to the customer home. */
  brandHref?: string;
  /** The section the customer is in, shown beside the brand. */
  productName?: string;
  navigation: CustomerNavigationItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  /** Who is signed in, e.g. "Laura Marín". Names the account control. */
  context?: ReactNode;
  /** The quiet second line under the name, e.g. "Shipper · Finance". */
  contextDetail?: ReactNode;
  /** Left of the red strip: the organisation this session belongs to. */
  utilityContext?: ReactNode;
  /** The audience chip beside it, e.g. "CUSTOMER". */
  utilityBadge?: ReactNode;
  /** Initials for the account avatar. */
  initials?: string;
  /** Right of the red strip, beside the account: the language switch. */
  utilityActions?: ReactNode;
  /**
   * What the account control opens: `DropdownMenuItem`s for the account page,
   * signing out, anything else that belongs to the person rather than the page.
   * Drawn under their name and roles, which the menu supplies itself.
   */
  accountMenu?: ReactNode;
  /** Names the account control for assistive technology, e.g. "Your account". */
  accountLabel?: string;
  /** Notifications control, left of the account. Omitted when there are none. */
  notifications?: ReactNode;
  /** The page's primary call to action, e.g. "Request a quotation". */
  actions?: ReactNode;
  footerCopyright: string;
  navigationLabel: string;
  menuLabel: string;
  closeLabel: string;
  skipLabel: string;
  children: ReactNode;
}

/**
 * The shell a customer sees.
 *
 * A website, not an application: a red brand strip, a white header with
 * horizontal navigation, content that can run edge to edge, and a footer. The
 * staff shell is untouched and stays a sidebar application — the two are meant
 * to be told apart at a glance, because they are used in completely different
 * ways by completely different people.
 *
 * Built on the design system's Header and Footer, which were written for a
 * public-facing surface and until now had no consumer.
 */
export function CustomerShell({
  brand,
  brandHref = '/app',
  productName,
  navigation,
  activeId,
  onNavigate,
  context,
  contextDetail,
  initials,
  utilityContext,
  utilityBadge,
  utilityActions,
  accountMenu,
  accountLabel,
  notifications,
  actions,
  footerCopyright,
  navigationLabel,
  menuLabel,
  closeLabel,
  skipLabel,
  children,
}: CustomerShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const previousPage = useRef(activeId);

  // Moving to another destination starts you at the top of it, and puts focus
  // where the new content begins rather than leaving it on a closed menu.
  useEffect(() => {
    if (previousPage.current !== activeId) {
      previousPage.current = activeId;
      setMenuOpen(false);
      window.scrollTo({ top: 0 });
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [activeId]);

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 769px)');
    const closeOnDesktop = () => {
      if (media?.matches) setMenuOpen(false);
    };
    media?.addEventListener('change', closeOnDesktop);
    return () => media?.removeEventListener('change', closeOnDesktop);
  }, []);

  const link = (item: CustomerNavigationItem) => {
    // What the word alone does not say: why it cannot be opened, or what the
    // number beside it counts. A bare "0" is ambiguous read out loud.
    const detail = item.disabled && item.statusLabel ? item.statusLabel : item.countLabel;

    const attributes = {
      className: styles.navLink,
      'aria-current': activeId === item.id ? ('page' as const) : undefined,
      'aria-disabled': item.disabled || undefined,
      title: detail ? `${item.label} - ${detail}` : undefined,
      'aria-label': detail ? `${item.label}, ${detail}` : undefined,
    };

    const content = (
      <>
        {item.label}
        {typeof item.count === 'number' && (
          <span className={styles.navCount} aria-hidden="true">
            {item.count}
          </span>
        )}
      </>
    );

    // A real href keeps middle-click and "open in new tab" working; the click
    // handler turns an ordinary click into an in-app navigation.
    return item.href && !item.disabled ? (
      <a
        key={item.id}
        {...attributes}
        href={item.href}
        onClick={(event) => {
          if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            onNavigate(item.id);
          }
        }}
      >
        {content}
      </a>
    ) : (
      <button key={item.id} type="button" {...attributes} disabled={item.disabled}>
        {content}
      </button>
    );
  };

  return (
    <div className={styles.shell}>
      <a
        className={styles.skip}
        href="#customer-main"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {skipLabel}
      </a>

      {(utilityContext || utilityActions || accountMenu) && (
        <div className={styles.utility}>
          <div className={styles.utilityInner}>
            <span className={styles.utilityContext}>
              <span className={styles.utilityWho}>{utilityContext}</span>
              {utilityBadge && <span className={styles.utilityBadge}>{utilityBadge}</span>}
            </span>
            <div className={styles.utilityActions}>
              {utilityActions}
              {/*
                The person, on the strip that says who this session belongs to.
                Everything that is about them rather than about the page lives
                behind it - so the white bar below carries the product and only
                the product, and signing out cannot be hit by accident on the way
                to a navigation link.
              */}
              {accountMenu && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className={styles.accountTrigger} aria-label={accountLabel}>
                      {initials && (
                        <span className={styles.utilityAvatar} aria-hidden="true">
                          {initials}
                        </span>
                      )}
                      {context && <span className={styles.accountName}>{context}</span>}
                      <ChevronDown aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={styles.accountMenu}>
                    {context && <DropdownMenuLabel>{context}</DropdownMenuLabel>}
                    {contextDetail && <span className={styles.accountDetail}>{contextDetail}</span>}
                    {(context || contextDetail) && <DropdownMenuSeparator />}
                    {accountMenu}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      )}

      <Header
        width="full"
        logo={
          <a href={brandHref} className={styles.logo}>
            {brand}
          </a>
        }
        productName={productName}
        navLabel={navigationLabel}
        nav={navigation.map(link)}
        actions={
          <div className={styles.identity}>
            {/* Header hides its nav slot on small screens, so the control that
                opens the menu has to live here, where it is always rendered. */}
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <button type="button" className={`noa-icon-button ${styles.menuButton}`} aria-label={menuLabel}>
                  <Menu aria-hidden="true" />
                </button>
              </DialogTrigger>
              <DialogContent side="left" closeLabel={closeLabel} aria-describedby={undefined}>
                <DialogTitle>{navigationLabel}</DialogTitle>
                <nav className={styles.mobileNav} aria-label={navigationLabel}>
                  {navigation.map(link)}
                </nav>
              </DialogContent>
            </Dialog>
            {actions}
            {notifications}
          </div>
        }
      />

      <main ref={mainRef} id="customer-main" tabIndex={-1} className={styles.main}>
        {children}
      </main>

      <Footer copyright={footerCopyright} />
    </div>
  );
}

/** Wraps page content to the brand measure. Omit it for a full-bleed band. */
export function CustomerMeasure({ children }: { children: ReactNode }) {
  return <div className={styles.measure}>{children}</div>;
}
