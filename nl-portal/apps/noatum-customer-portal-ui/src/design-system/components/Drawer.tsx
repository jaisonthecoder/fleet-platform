import type { ReactNode } from 'react';

import { cn } from '../utils';

interface DrawerPartProps {
  children: ReactNode;
  className?: string;
}

/** White band at the top of a side sheet: title, and any subtitle or status. */
export function DrawerHeader({ children, className }: DrawerPartProps) {
  return <div className={cn('noa-drawer-header', className)}>{children}</div>;
}

/** The tinted scrolling area between header and footer. */
export function DrawerBody({ children, className }: DrawerPartProps) {
  return <div className={cn('noa-drawer-body', className)}>{children}</div>;
}

/** White band at the bottom, so the actions stay reachable however long the form. */
export function DrawerFooter({ children, className }: DrawerPartProps) {
  return <div className={cn('noa-drawer-footer', className)}>{children}</div>;
}

export interface DrawerCardProps extends DrawerPartProps {
  title?: string;
  ariaLabel?: string;
  /** Two fields to a row. Anything that needs the full width takes <DrawerWide>. */
  columns?: 1 | 2;
}

/** One group of related fields, as a white block on the sheet's tint. */
export function DrawerCard({ title, ariaLabel, columns = 1, children, className }: DrawerCardProps) {
  return (
    <section className={cn('noa-drawer-card', className)} aria-label={ariaLabel ?? title}>
      {title ? <h3 className="noa-drawer-card-title">{title}</h3> : null}
      {columns === 2 ? <div className="noa-drawer-fields">{children}</div> : children}
    </section>
  );
}

/** Makes one child span both columns of a two-column card. */
export function DrawerWide({ children, className }: DrawerPartProps) {
  return <div className={cn('noa-drawer-wide', className)}>{children}</div>;
}
