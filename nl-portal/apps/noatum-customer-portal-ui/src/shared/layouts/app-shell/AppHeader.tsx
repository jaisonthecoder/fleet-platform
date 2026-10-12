import type { ReactNode } from 'react';

export function AppHeader({
  brand,
  utility,
  actions,
  globalSearch,
  moduleNavigation,
  mobileNavigation,
}: {
  brand: ReactNode;
  utility: ReactNode;
  actions: ReactNode;
  globalSearch?: ReactNode;
  moduleNavigation?: ReactNode;
  mobileNavigation: ReactNode;
}) {
  return (
    <>
      <div className="noa-utility">
        <div className="noa-shell-width">{utility}</div>
      </div>
      <header className="noa-shell-header">
        <div className="noa-shell-width noa-header-row">
          <div className="noa-mobile-menu">{mobileNavigation}</div>
          <div className="noa-brand">{brand}</div>
          {globalSearch && <div className="noa-global-search">{globalSearch}</div>}
          <div className="noa-shell-actions">{actions}</div>
          {moduleNavigation && <div className="noa-module-nav">{moduleNavigation}</div>}
        </div>
      </header>
    </>
  );
}
