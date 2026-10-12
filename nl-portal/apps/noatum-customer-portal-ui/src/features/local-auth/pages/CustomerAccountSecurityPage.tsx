import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';

import { StatePanel } from '../../../design-system';
import { CustomerMeasure } from '../../../shared/layouts/customer-shell';
import type { CustomerSession } from '../../../app/layouts/CustomerPortalLayout';
import AccountSecurityPage from './AccountSecurityPage';

/**
 * The same security screen the staff portal uses, inside the customer shell.
 *
 * One component for both audiences on purpose: a password, a second factor and a
 * list of sessions behave identically whoever owns them, and two copies would
 * drift the moment one is changed.
 */
export function CustomerAccountSecurityPage() {
  const { t } = useTranslation();
  const session = useOutletContext<CustomerSession>();

  return (
    <CustomerMeasure>
      {session ? <AccountSecurityPage /> : <StatePanel title={t('customerNavSignInRequired')} />}
    </CustomerMeasure>
  );
}
