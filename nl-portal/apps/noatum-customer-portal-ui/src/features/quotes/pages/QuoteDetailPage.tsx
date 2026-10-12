import { useTranslation } from 'react-i18next';
import { useOutletContext, useParams } from 'react-router-dom';

import type { CustomerSession } from '../../../app/layouts/CustomerPortalLayout';
import { StatePanel } from '../../../design-system';
import { CustomerMeasure } from '../../../shared/layouts/customer-shell';
import type { LookupWriteError } from '../../admin/api/lookups';
import { AccessError } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import {
  useAcceptQuote,
  useCancelQuote,
  useDeclineQuote,
  useQuote,
} from '../api/quotes';
import { QuoteOptionsPage } from './QuoteOptionsPage';
import { QuoteProgressPage } from './QuoteProgressPage';

function errorKey(error: unknown) {
  return error instanceof StaffError
    ? error.kind
    : error instanceof AccessError
      ? 'denied'
      : 'unavailable';
}

/** Routes the customer to either the waiting journey or the priced decision page. */
export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const session = useOutletContext<CustomerSession>();

  const quote = useQuote(id);
  const accept = useAcceptQuote();
  const decline = useDeclineQuote();
  const cancel = useCancelQuote();

  if (quote.error) {
    return (
      <CustomerMeasure>
        <div role="alert">
          <StatePanel title={t(errorKey(quote.error))} />
        </div>
      </CustomerMeasure>
    );
  }

  if (quote.isPending || !quote.data) {
    return (
      <CustomerMeasure>
        <div role="status">
          <StatePanel title={t('loading')} />
        </div>
      </CustomerMeasure>
    );
  }

  const data = quote.data;
  const mayDecide = Boolean(session?.permissions.includes('quotes.accept'));
  const mayCancel = Boolean(session?.permissions.includes('quotes.cancel'));
  const failure = (accept.error ?? decline.error ?? cancel.error) as LookupWriteError | null;
  const failureMessage = failure ? failure.message || t('unavailable') : null;

  if (data.options.length > 0) {
    return (
      <QuoteOptionsPage
        data={data}
        canDecide={mayDecide}
        busy={accept.isPending || decline.isPending}
        failure={failureMessage}
        onAccept={(optionId) =>
          accept.mutateAsync({ id: data.id, optionId, version: data.version })
        }
        onDecline={(reason) => decline.mutateAsync({ id: data.id, reason })}
      />
    );
  }

  return (
    <QuoteProgressPage
      data={data}
      canWithdraw={mayCancel}
      busy={cancel.isPending}
      failure={failureMessage}
      onWithdraw={() => cancel.mutateAsync(data.id)}
    />
  );
}
