import { useTranslation } from 'react-i18next';
import { SectionHeading, StatePanel } from '../../../design-system';
import styles from './AdminPage.module.css';

/**
 * Scaffold for an administration section whose screen is not designed yet.
 *
 * It states what the section will hold and which source feeds it, and shows no
 * table: an empty grid of invented rows would read as real data.
 */
export function AdminSectionPage({ section }: { section: string }) {
  const { t } = useTranslation('staff');
  return (
    <section className={styles.page}>
      <SectionHeading as="h1" size="lg" title={t(`nav_${section}`)} description={t(`page_${section}`)} />
      <div className={styles.panel}>
        <StatePanel title={t('pagePending')}>{t('pagePendingDescription')}</StatePanel>
      </div>
    </section>
  );
}
