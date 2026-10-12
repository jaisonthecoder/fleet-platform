import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './RequestDrawer.module.css';

/**
 * The request as submitted, in a sheet from the right.
 *
 * The SHELL only: the sheet, the header, the tab row and the numbered sections.
 * What goes in them is the caller's, because the two audiences are not looking
 * at the same thing - a pricer needs the CargoWise organisation and who at the
 * customer sent it, and the customer needs neither. Sharing the content as well
 * would mean one component deciding what each audience may see, which is exactly
 * the decision that belongs in the feature.
 *
 * It holds no API types and no strings. Both callers generate their own client
 * from the OpenAPI document and pass in the pieces already translated.
 */

/** One labelled value inside a section. */
export interface RequestFact {
  label: string;
  value: ReactNode | null | undefined;
  /** Spans the grid, for an address or a paragraph. */
  wide?: boolean;
}

export interface RequestSection {
  title: string;
  /** What this section covers, in the words the form used for its own steps. */
  keys?: string;
  facts?: RequestFact[];
  /** Anything a fact grid cannot hold: a table, a summary, a note. */
  body?: ReactNode;
}

export interface RequestTab {
  id: string;
  label: string;
  sections: RequestSection[];
}

interface Props {
  /** e.g. "Full quote request · as submitted". */
  eyebrow: string;
  title: string;
  /** The line under the title: when it was sent, by whom, for which account. */
  provenance: ReactNode;
  tabs: RequestTab[];
  closeLabel: string;
  sectionsLabel: string;
  onClose: () => void;
}

export function RequestDrawer({
  eyebrow, title, provenance, tabs, closeLabel, sectionsLabel, onClose,
}: Props) {
  const [open, setOpen] = useState(tabs[0]?.id ?? '');
  const current = tabs.find((tab) => tab.id === open) ?? tabs[0];

  // Escape closes it, like every other sheet in the product.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Numbered across the whole tab, so a section carries the same number the tab
     row gave it and the reader can tell where they are. */
  let number = tabs.findIndex((tab) => tab.id === current?.id);

  return (
    <>
      <button type="button" className={styles.scrim} aria-label={closeLabel} onClick={onClose} />

      <aside className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.head}>
          <div className={styles.headTop}>
            <div>
              <p className={styles.eyebrow}>{eyebrow}</p>
              <h2 className={styles.title}>{title}</h2>
            </div>
            <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <p className={styles.provenance}>{provenance}</p>

          <ul className={styles.tabs} role="tablist" aria-label={sectionsLabel}>
            {tabs.map((tab, index) => (
              <li key={tab.id} role="presentation">
                <button
                  type="button"
                  role="tab"
                  className={styles.tab}
                  aria-selected={tab.id === current?.id}
                  onClick={() => setOpen(tab.id)}
                >
                  <span className={styles.tabNumber}>{index + 1}</span>
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.body}>
          {current?.sections.map((section) => {
            number += 1;
            return (
              <section className={styles.section} key={section.title} aria-label={section.title}>
                <div className={styles.sectionHead}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.sectionNumber} aria-hidden="true">{number}</span>
                    {section.title}
                  </h3>
                  {section.keys && <span className={styles.sectionKeys}>{section.keys}</span>}
                </div>

                {section.facts && section.facts.length > 0 && (
                  <dl className={styles.facts}>
                    {section.facts.map((fact) => {
                      const empty = fact.value === null || fact.value === undefined || fact.value === '';
                      return (
                        <div
                          className={`${styles.fact} ${fact.wide ? styles.wide : ''}`.trim()}
                          key={fact.label}
                        >
                          <dt>{fact.label}</dt>
                          {/* An answer nobody gave reads as an em dash, never as a
                              blank cell that looks like a loading failure. */}
                          <dd data-empty={empty ? 'true' : undefined}>{empty ? '—' : fact.value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}

                {section.body && <div className={styles.block}>{section.body}</div>}
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
}
