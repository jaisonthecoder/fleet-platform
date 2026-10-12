import { useTranslation } from 'react-i18next';
import { Textarea } from '../../../design-system';
import styles from './MessagePanel.module.css';

/** The lines a covering note nearly always carries, typed once instead of always. */
const SNIPPETS = ['space', 'freeTime', 'dangerousGoods', 'confirm'] as const;

interface Props {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}

/**
 * The message to the customer.
 *
 * A draft, editable, and sent only on publish - never on save. The snippets add
 * editable text and send nothing on their own: no automated wording leaves this
 * platform without a person pressing the send beside it.
 */
export function MessagePanel({ value, onChange, disabled }: Props) {
  const { t } = useTranslation('staff');

  const add = (key: string) => {
    const sentence = t(`snippet_${key}`);
    onChange(value.trim() === '' ? sentence : `${value.trimEnd()}\n${sentence}`);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>{t('messageToCustomer')}</span>
      </div>
      <div className={styles.body}>
        <Textarea
          label={t('messageToCustomer')}
          labelHidden
          rows={4}
          maxLength={8000}
          placeholder={t('messagePlaceholder')}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <ul className={styles.snippets}>
          {SNIPPETS.map((key) => (
            <li key={key}>
              <button type="button" className={styles.snippet} disabled={disabled} onClick={() => add(key)}>
                {t(`snippetName_${key}`)}
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.hint}>{t('messageHint')}</p>
      </div>
    </div>
  );
}
