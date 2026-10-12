import {
  forwardRef,
  useId,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type HTMLAttributes,
} from 'react';
import { Search, X } from 'lucide-react';

import styles from './ComponentDirectory.module.css';

export interface ComponentDirectoryItem {
  code: string;
  name: string;
  group: string;
  keywords?: readonly string[];
  href?: string;
}

export interface ComponentDirectoryLabels {
  eyebrow: string;
  searchLabel: string;
  searchPlaceholder: string;
  groupsLabel: string;
  allGroups: string;
  clearSearch: string;
  empty: string;
  results: (visible: number, total: number) => string;
}

export interface ComponentDirectoryProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  items: readonly ComponentDirectoryItem[];
  labels: ComponentDirectoryLabels;
  groupOrder?: readonly string[];
  locale?: string;
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  group?: string;
  defaultGroup?: string;
  onGroupChange?: (group: string) => void;
  selectedCode?: string;
  onSelect?: (item: ComponentDirectoryItem) => void;
  renderItem?: (item: ComponentDirectoryItem) => React.ReactNode;
}

function normalized(value: string, locale: string) {
  return value.trim().toLocaleLowerCase(locale);
}

/**
 * Searchable and group-filtered catalogue from the Noatum UI kit directory.
 *
 * The component owns presentation and optional local control state only. Callers
 * provide catalogue data, translated labels, navigation targets and selection
 * behaviour, so the directory can document any component set without feature logic.
 */
export const ComponentDirectory = forwardRef<HTMLElement, ComponentDirectoryProps>(
  function ComponentDirectory(
    {
      items,
      labels,
      groupOrder,
      locale = 'en-US',
      query: controlledQuery,
      defaultQuery = '',
      onQueryChange,
      group: controlledGroup,
      defaultGroup,
      onGroupChange,
      selectedCode,
      onSelect,
      renderItem,
      className,
      ...rest
    },
    ref,
  ) {
    const searchId = useId();
    const searchRef = useRef<HTMLInputElement>(null);
    const [localQuery, setLocalQuery] = useState(defaultQuery);
    const groups = Array.from(new Set(items.map((item) => item.group)));
    const orderedGroups = groupOrder
      ? [
          ...groupOrder.filter((entry) => groups.includes(entry)),
          ...groups.filter((entry) => !groupOrder.includes(entry)),
        ]
      : groups;
    const fallbackGroup = defaultGroup && groups.includes(defaultGroup) ? defaultGroup : '';
    const [localGroup, setLocalGroup] = useState(fallbackGroup);
    useEffect(() => {
      if (
        controlledGroup === undefined &&
        !localGroup &&
        defaultGroup &&
        groups.includes(defaultGroup)
      )
        setLocalGroup(defaultGroup);
    }, [controlledGroup, defaultGroup, groups, localGroup]);
    const query = controlledQuery ?? localQuery;
    const selectedGroup = controlledGroup ?? localGroup;
    const normalizedQuery = normalized(query, locale);
    const visibleItems = items.filter((item) => {
      if (selectedGroup && item.group !== selectedGroup) return false;
      if (!normalizedQuery) return true;
      return normalized(
        [item.code, item.name, item.group, ...(item.keywords ?? [])].join(' '),
        locale,
      ).includes(normalizedQuery);
    });

    const updateQuery = (nextQuery: string) => {
      if (controlledQuery === undefined) setLocalQuery(nextQuery);
      onQueryChange?.(nextQuery);
    };

    const updateGroup = (nextGroup: string) => {
      if (controlledGroup === undefined) setLocalGroup(nextGroup);
      onGroupChange?.(nextGroup);
    };

    const activateItem = (item: ComponentDirectoryItem) => {
      onSelect?.(item);
    };

    return (
      <section
        ref={ref}
        className={[styles.directory, className ?? ''].filter(Boolean).join(' ')}
        {...rest}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>{labels.eyebrow}</span>
            <strong className={styles.resultCount} aria-live="polite">
              {labels.results(visibleItems.length, items.length)}
            </strong>
          </div>

          <div className={styles.searchField}>
            <Search aria-hidden="true" />
            <label className="noa-visually-hidden" htmlFor={searchId}>
              {labels.searchLabel}
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              ref={searchRef}
              placeholder={labels.searchPlaceholder}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.clear}
                aria-label={labels.clearSearch}
                onClick={() => {
                  updateQuery('');
                  searchRef.current?.focus();
                }}
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        <div className={styles.filters} role="group" aria-label={labels.groupsLabel}>
          <button
            type="button"
            className={styles.filter}
            aria-label={`${labels.allGroups} ${items.length}`}
            aria-pressed={!selectedGroup}
            onClick={() => updateGroup('')}
          >
            {labels.allGroups}
            <span>{items.length}</span>
          </button>
          {orderedGroups.map((entry) => (
            <button
              key={entry}
              type="button"
              className={styles.filter}
              aria-label={`${entry} ${items.filter((item) => item.group === entry).length}`}
              aria-pressed={selectedGroup === entry}
              onClick={() => updateGroup(entry)}
            >
              {entry}
              <span>{items.filter((item) => item.group === entry).length}</span>
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {visibleItems.length ? (
            <div className={styles.grid}>
              {visibleItems.map((item) =>
                renderItem ? (
                  <div key={item.code} className={styles.item}>
                    {renderItem(item)}
                  </div>
                ) : item.href ? (
                  <a
                    key={item.code}
                    className={styles.item}
                    href={item.href}
                    aria-current={selectedCode === item.code ? 'true' : undefined}
                    data-selected={selectedCode === item.code || undefined}
                    onClick={(event) => {
                      if (onSelect) {
                        event.preventDefault();
                        activateItem(item);
                      }
                    }}
                  >
                    <span className={styles.code}>{item.code}</span>
                    <span className={styles.name}>{item.name}</span>
                  </a>
                ) : onSelect ? (
                  <button
                    key={item.code}
                    type="button"
                    className={styles.item}
                    aria-label={`${item.code} ${item.name}`}
                    aria-current={selectedCode === item.code ? 'true' : undefined}
                    data-selected={selectedCode === item.code || undefined}
                    disabled={!onSelect}
                    onClick={() => activateItem(item)}
                  >
                    <span className={styles.code}>{item.code}</span>
                    <span className={styles.name}>{item.name}</span>
                  </button>
                ) : (
                  <div
                    key={item.code}
                    className={styles.item}
                    data-selected={selectedCode === item.code || undefined}
                  >
                    <span className={styles.code}>{item.code}</span>
                    <span className={styles.name}>{item.name}</span>
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className={styles.empty}>{labels.empty}</p>
          )}
        </div>
      </section>
    );
  },
);
