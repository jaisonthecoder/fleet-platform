import { type ReactNode, useState } from 'react';
import { Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from '../primitives/tabs';

import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  /** Small count badge, e.g. unread documents. */
  badge?: number;
}

export interface TabsProps {
  items: TabItem[];
  /** Uncontrolled default. Omit `value` to let Tabs manage selection. */
  defaultTabId?: string;
  /** Controlled selection. Pass with onChange. */
  value?: string;
  onChange?: (tabId: string) => void;
  ariaLabel: string;
}

/**
 * Tabs with the keyboard behaviour the ARIA pattern requires: arrows move between
 * tabs, Home/End jump to the ends, and only the active tab is in the tab order.
 *
 * Disabled tabs are skipped rather than focused-and-blocked, which is what makes arrow
 * navigation feel right.
 */
export function Tabs({ items, defaultTabId, value, onChange, ariaLabel }: TabsProps) {
  const [internal, setInternal] = useState(defaultTabId ?? items.find((item) => !item.disabled)?.id ?? '');

  const activeId = value ?? internal;
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const active = items[activeIndex] ?? items[0];

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  };

  return (
    <TabsRoot className={styles.wrapper} value={activeId} onValueChange={select}>
      <TabsList className={styles.tablist} aria-label={ariaLabel}>
        {items.map((item) => {
          const selected = item.id === active?.id;
          return (
            <TabsTrigger
              key={item.id}
              value={item.id}
              disabled={item.disabled}
              className={[styles.tab, selected ? styles.selected : ''].filter(Boolean).join(' ')}
            >
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className={styles.badge}>{item.badge}</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {active && (
        <TabsContent
          value={active.id}
          className={styles.panel}
          tabIndex={0}
        >
          {active.content}
        </TabsContent>
      )}
    </TabsRoot>
  );
}
