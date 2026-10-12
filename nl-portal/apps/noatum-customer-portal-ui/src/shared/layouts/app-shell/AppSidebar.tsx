import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function AppSidebar({
  collapsed,
  onToggle,
  collapseLabel,
  expandLabel,
  context,
  navigationLabel,
  note,
  children,
}: {
  collapsed: boolean;
  onToggle: () => void;
  collapseLabel: string;
  expandLabel: string;
  context: ReactNode;
  navigationLabel: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside className="noa-sidebar">
      <button
        type="button"
        className="noa-sidebar-toggle"
        aria-expanded={!collapsed}
        aria-controls="shell-sidebar-navigation"
        aria-label={collapsed ? expandLabel : collapseLabel}
        title={collapsed ? expandLabel : collapseLabel}
        onClick={onToggle}
      >
        {collapsed
          ? <ChevronRight aria-hidden="true" />
          : <ChevronLeft aria-hidden="true" />}
      </button>
      {context ? <div className="noa-sidebar-context">{context}</div> : null}
      <nav id="shell-sidebar-navigation" aria-label={navigationLabel}>
        {children}
      </nav>
      {note && <p className="noa-sidebar-note">{note}</p>}
    </aside>
  );
}
