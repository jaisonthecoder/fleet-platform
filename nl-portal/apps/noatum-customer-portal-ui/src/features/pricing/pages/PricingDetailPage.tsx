import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogTitle, DrawerBody, DrawerCard, DrawerFooter, DrawerHeader,
  Input, StatePanel, formatDate,
} from '../../../design-system';
import { AccessError } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import type { LookupWriteError } from '../../admin/api/lookups';
import { useFeature } from '../../../shared/features/useFeature';
import { PricingPanel } from '../../ai-assistant/PricingPanel';
import type {
  AssistDraftOption, AssistOption, AssistQuestion,
} from '../../ai-assistant/api/aiPricing';
import {
  useApproveQuote, useClaimQuote, useForceReleaseQuote, usePriceQuote, usePricingQuote,
  usePublishQuote, useReleaseQuote, useSendBackQuote,
} from '../api/pricing';
import {
  emptyOption, fromApiOption, OptionEditor, optionTotal, toApiOption, type DraftOption,
} from '../components/OptionEditor';
import { OptionCards } from '../components/OptionCards';
import { CustomerPreview } from '../components/CustomerPreview';
import { Journey } from '../components/Journey';
import { MessagePanel } from '../components/MessagePanel';
import { PublishPanel } from '../components/PublishPanel';
import { StaffRequestDrawer, type RequestExtras } from '../components/StaffRequestDrawer';
import { RequestHero } from '../components/RequestHero';
import { SendChecks, useChecks } from '../components/SendChecks';
import styles from './PricingDetailPage.module.css';

function errorKey(error: unknown) {
  return error instanceof StaffError ? error.kind : error instanceof AccessError ? 'denied' : 'unavailable';
}

/**
 * The comparable shape of a price.
 *
 * An option with no charge lines is dropped first: the editor seeds a blank one on
 * every quote nobody has priced yet, and comparing that against the empty set the
 * API holds would report unsaved work on a request that was only just opened.
 */
function savedShape(options: ReturnType<typeof toApiOption>[]): string {
  return JSON.stringify(options.filter((option) => option.chargeLines.length > 0));
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function PricingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('staff');
  // The request form's own labels - direction, scope, the add-on services - live in
  // the default namespace. Staff read back the exact words the customer chose
  // rather than a second translation of the same thing, which is how the two ends
  // of one request start disagreeing.
  const { t: common } = useTranslation();
  const navigate = useNavigate();

  const quote = usePricingQuote(id);
  const claim = useClaimQuote();
  const release = useReleaseQuote();
  const forceRelease = useForceReleaseQuote();
  const price = usePriceQuote();
  const approve = useApproveQuote();
  const sendBack = useSendBackQuote();
  const publish = usePublishQuote();

  // The API enforces both; these only stop a specialist filling in a form that
  // would be refused at the end.
  const mayPriceHere = useFeature('quotations.portal_pricing');
  const mayOfferSeveral = useFeature('quotations.multi_option');
  const aiAssistEnabled = useFeature('pricing.ai_assist');

  const [options, setOptions] = useState<DraftOption[]>([]);
  const [open, setOpen] = useState(0);
  const [message, setMessage] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [forcing, setForcing] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showingRequest, setShowingRequest] = useState(false);
  // Where the assistant's most recent batch of options starts in `options`.
  const assistBase = useRef(0);

  const data = quote.data;

  // What the API holds, in the shape the editor would post back. Compared rather
  // than tracked with a flag: a flag says "saved" until something sets it false,
  // and a background refetch is exactly the thing that forgets to.
  const storedShape = useMemo(
    () => savedShape((data?.options ?? []).map((option) => toApiOption(fromApiOption(option)))),
    [data?.options],
  );

  /*
   * Seeded DURING RENDER rather than in an effect. React supports this for "reset
   * state when the input changes" and it avoids the cascading render an effect
   * would cause.
   *
   * The key is the quote AND the price the API holds, not the quote alone. Keyed
   * on the id alone, saving cleared the key to force a re-seed - but the re-seed
   * ran against the response still in cache, which was the quote BEFORE the save,
   * so the editor blanked itself and then never recovered, because by the time the
   * refetch landed the key matched again. Keyed on the stored price, a save seeds
   * nothing until the new price arrives, and then seeds the price that was just
   * saved. A background refetch that changes nothing changes no key, so work in
   * progress survives it.
   */
  const seedKey = data ? `${data.id}:${storedShape}:${data.messageToCustomer ?? ''}` : null;

  if (data && seedKey !== null && loadedFor !== seedKey) {
    setLoadedFor(seedKey);
    setOptions(
      data.options.length > 0
        ? data.options.map(fromApiOption)
        : [emptyOption(data.currency, addDays(data.defaultValidityDays))],
    );
    setMessage(data.messageToCustomer ?? '');
    setOpen(0);
  }

  const failure = (price.error ?? claim.error ?? release.error ?? forceRelease.error
    ?? approve.error ?? sendBack.error ?? publish.error) as LookupWriteError | null;

  const dirty =
    savedShape(options.map(toApiOption)) !== storedShape
    || message.trim() !== (data?.messageToCustomer ?? '').trim();

  // The dearest option decides whether four eyes are needed. One function does this
  // arithmetic for the whole screen; a second copy here is how the approval gate
  // and the total on the card start disagreeing.
  const highestTotal = options.reduce((max, option) => Math.max(max, optionTotal(option)), 0);

  const needsApproval =
    (data?.approvalRequired ?? false) && highestTotal > (data?.approvalThresholdMinorUnits ?? 0);

  const checks = useChecks({
    options,
    dirty,
    disclosesCarrier: data?.disclosesCarrier ?? false,
    message,
    needsApproval,
    approved: data?.status === 'approved',
  });

  if (quote.error) {
    return (
      <section className={styles.page}>
        <div className={styles.rise} role="alert">
          <StatePanel title={t(errorKey(quote.error))} />
        </div>
      </section>
    );
  }

  if (quote.isPending || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.rise} role="status"><StatePanel title={t('loading')} /></div>
      </section>
    );
  }

  const extra = (data.payload ?? {}) as RequestExtras;
  const unclaimed = data.claimedById === null;
  const heldByOther = !unclaimed && !data.claimedByMe;
  const editable = (data.claimedByMe || unclaimed) && mayPriceHere;
  const current = options[Math.min(open, options.length - 1)];
  const blocking = checks.filter((check) => !check.met && check.blocking).length;
  const advisory = checks.filter((check) => !check.met && !check.blocking).length;
  const busy = claim.isPending || release.isPending || price.isPending
    || approve.isPending || publish.isPending;

  /* The eyebrow over the hero title: what was asked for, in one line. */
  const service = [
    t(`mode_${data.mode}`, { defaultValue: data.mode }),
    data.loadType,
    extra.direction ? common(`reqDirection_${extra.direction}`, { defaultValue: extra.direction }) : null,
    data.incoterm && extra.namedPlace ? `${data.incoterm} ${extra.namedPlace}` : data.incoterm,
    extra.scope ? common(`reqScope_${extra.scope}`, { defaultValue: extra.scope }) : null,
  ].filter(Boolean).join(' · ');

  /* What has to be settled before this can be priced properly. Each is a real
     condition of the request, not a warning we invented to fill the band. */
  const flags = [
    data.dangerousGoods.length > 0 ? t('flagDangerousGoods') : null,
    data.temperatureControl !== null ? t('flagReefer') : null,
    data.oversizeItems.length > 0 ? t('flagOversize') : null,
    (extra.scope === 'door_door' || extra.scope === 'door_port')
      && !extra.pickupAddress ? t('flagNoPickup') : null,
    (extra.scope === 'door_door' || extra.scope === 'port_door')
      && !extra.deliveryAddress ? t('flagNoDelivery') : null,
  ].filter((flag): flag is string => flag !== null);

  const recommend = (key: string) =>
    setOptions((list) =>
      list.map((option) => ({
        ...option,
        // One recommendation per quote: the API refuses two, and the customer
        // reads two as a contradiction.
        isRecommended: option.key === key ? !option.isRecommended : false,
      })),
    );

  const save = async () => {
    await price.mutateAsync({
      id: data.id,
      body: {
        options: options.map(toApiOption),
        messageToCustomer: message.trim() === '' ? null : message.trim(),
      } as never,
    });
    // No re-seed here: the refetch this mutation triggers changes the seed key on
    // its own, and clearing the key first is what used to blank the editor.
    setSaved(true);
    window.setTimeout(() => setSaved(false), 4000);
  };

  const duplicate = () => {
    setOptions((list) => {
      const source = list[open];
      const copy: DraftOption = {
        ...source,
        key: crypto.randomUUID(),
        name: source.name.trim() === '' ? '' : t('optionCopyOf', { name: source.name }),
        isRecommended: false,
        lines: source.lines.map((line) => ({ ...line, key: crypto.randomUUID() })),
      };
      return [...list.slice(0, open + 1), copy, ...list.slice(open + 1)];
    });
    setOpen(open + 1);
  };

  const remove = () => {
    setOptions((list) => list.filter((_, index) => index !== open));
    setOpen(Math.max(0, open - 1));
  };

  /*
   * The assistant's work, applied.
   *
   * Appended, never substituted: an option the pricer has already started is not
   * something a draft may overwrite. The one exception is the blank option the
   * editor seeds on an unpriced quote, which is replaced because it is nobody's
   * work.
   */
  const applyAssistOptions = (proposed: AssistOption[], target: 'current' | 'new') => {
    const drafted: DraftOption[] = proposed.map((option) => ({
      key: crypto.randomUUID(),
      name: option.name,
      carrierName: option.carrierName,
      serviceRouting: option.serviceRouting,
      transitDaysMin: option.transitDaysMin,
      transitDaysMax: option.transitDaysMax,
      nextDepartures: option.nextDepartures,
      freeTimeDays: option.freeTimeDays,
      validUntil: option.validUntil || addDays(data.defaultValidityDays),
      isRecommended: false,
      notes: option.notes,
      termsIncluded: '', termsExcluded: '', termsPayment: '', termsSubjectTo: '',
      currency: option.currency || data.currency,
      lines: option.lines.map((line) => ({
        key: crypto.randomUUID(),
        code: line.code,
        description: line.description,
        basis: line.basis,
        quantity: line.quantity,
        rate: line.rate,
        currency: line.currency || option.currency || data.currency,
        cost: '',
      })),
    }));

    setOptions((list) => {
      /*
       * `current` rewrites the option being looked at, keeping the name and the
       * recommendation flag the pricer chose: "fill this in" means this one, not
       * a fourth one nobody asked for. Only `new` grows the list.
       */
      if (target === 'current' && list.length > 0) {
        const at = Math.min(open, list.length - 1);
        const existing = list[at]!;
        const first = drafted[0]!;
        assistBase.current = at;
        return list.map((option, index) =>
          index === at
            ? {
                ...first,
                key: existing.key,
                name: existing.name.trim() === '' ? first.name : existing.name,
                isRecommended: existing.isRecommended,
                termsIncluded: existing.termsIncluded,
                termsExcluded: existing.termsExcluded,
                termsPayment: existing.termsPayment,
                termsSubjectTo: existing.termsSubjectTo,
              }
            : option,
        );
      }

      const untouched =
        list.length === 1
        && list[0]!.lines.every((line) => line.description.trim() === '' && line.rate.trim() === '');
      const next = untouched ? drafted : [...list, ...drafted];
      /* Where the assistant's own options start. Its questions are numbered from
         its own first option, so without this offset an answer about the option it
         just added lands on whatever happens to be first in the editor. */
      assistBase.current = untouched ? 0 : list.length;
      setOpen(assistBase.current);
      // A second option only reaches the API when the switch allows several.
      return mayOfferSeveral ? next : next.slice(0, 1);
    });
  };

  /** One answer, written into the option the question named. */
  const applyAssistAnswer = (question: AssistQuestion, answer: string) => {
    const value = answer.trim();
    if (value === '') return;
    const target = assistBase.current + question.optionIndex;

    setOptions((list) =>
      list.map((option, index) => {
        if (index !== target) return option;

        switch (question.field) {
          case 'carrierName':
            return { ...option, carrierName: value };
          case 'freeTimeDays':
            return { ...option, freeTimeDays: (/\d+/.exec(value)?.[0]) ?? option.freeTimeDays };
          case 'transitDaysMin': {
            // "28-32", "28 to 32" or "about 30" all mean the same thing here.
            const range = /(\d{1,3})\s*(?:-|–|to)\s*(\d{1,3})/.exec(value);
            if (range) return { ...option, transitDaysMin: range[1]!, transitDaysMax: range[2]! };
            const single = /(\d{1,3})/.exec(value);
            return single
              ? { ...option, transitDaysMin: single[1]!, transitDaysMax: single[1]! }
              : option;
          }
          default:
            return option;
        }
      }),
    );
  };

  /** What the editor holds, for a covering note to mention. Never a cost. */
  const assistDraft: AssistDraftOption[] = options.map((option) => ({
    name: option.name,
    carrierName: option.carrierName,
    transitDaysMin: option.transitDaysMin === '' ? null : Number(option.transitDaysMin),
    transitDaysMax: option.transitDaysMax === '' ? null : Number(option.transitDaysMax),
    freeTimeDays: option.freeTimeDays === '' ? null : Number(option.freeTimeDays),
    validUntil: option.validUntil,
    currency: option.currency,
    total: optionTotal(option) / 100,
  }));

  return (
    <section className={styles.page}>
      <RequestHero
        data={data}
        service={service}
        flags={flags}
        busy={busy}
        onHome={() => navigate('/portal/staff')}
        onQueue={() => navigate('/portal/pricing')}
        // Caught because the banner below already reports `failure`; without it a
        // refused claim surfaced as an unhandled rejection in the console.
        onClaim={() => { void claim.mutateAsync(data.id).catch(() => undefined); }}
        onRelease={() => { void release.mutateAsync(data.id).catch(() => undefined); }}
        onViewRequest={() => setShowingRequest(true)}
      />

      <div className={styles.rise}>
        {unclaimed && (
          <div className={styles.banner} role="status">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('claimBanner')}</p>
          </div>
        )}

        {heldByOther && (
          <div className={styles.banner} data-tone="info" role="status">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('heldByOther', { name: data.claimedByName ?? t('queueSomeone') })}</p>
            <button type="button" className={styles.bannerAction} onClick={() => setForcing(true)}>
              {t('forceRelease')}
            </button>
          </div>
        )}

        <Journey
          status={data.status}
          notes={{
            requested: formatDate(data.createdAt),
            claimed: data.claimedByName ?? t('stageUnclaimed'),
            priced: data.pricedByName ?? t('stageInProgress'),
            approved: needsApproval
              ? data.approvedByName ?? t('stageAwaiting')
              : t('stageNotRequired'),
            published: data.publishedAt ? formatDate(data.publishedAt) : undefined,
          }}
        />

        <div className={styles.columns}>
          <div className={styles.main}>
            <div className={styles.workspace}>
              <div className={styles.workspaceHead}>
                {/* The title row keeps the action on it: the eyebrow, the heading
                    and "add option" belong to the same line, and the description
                    runs full width beneath them. */}
                <div className={styles.workspaceTitleRow}>
                  <div className={styles.workspaceText}>
                    <p className={styles.workspaceEyebrow}>{t('pricingWorkArea')}</p>
                    <h2 className={styles.workspaceTitle}>{t('pricedOptions')}</h2>
                  </div>
                {mayOfferSeveral && (
                  <button
                    type="button"
                    className={styles.addOption}
                    disabled={!editable}
                    onClick={() => {
                      setOptions((list) => [
                        ...list,
                        emptyOption(list.at(-1)?.currency ?? data.currency, addDays(data.defaultValidityDays)),
                      ]);
                      setOpen(options.length);
                    }}
                  >
                    {t('addOptionShort')}
                  </button>
                )}
                </div>
                <p className={styles.workspaceLede}>{t('pricedOptionsLede')}</p>
              </div>

              <OptionCards options={options} open={open} onOpen={setOpen} />

              {current && (
                /*
                  A lookup category an administrator has emptied is a real state,
                  and every field these feed accepts free text - so an absent list
                  degrades to typing rather than to a blank screen.
                */
                <OptionEditor
                  option={current}
                  index={open}
                  canRecordCost={data.canRecordCost}
                  chargeBases={data.chargeBases}
                  carrierOptions={data.carrierOptions}
                  chargeCodes={data.chargeCodes ?? []}
                  currencyOptions={data.currencyOptions ?? []}
                  removable={options.length > 1}
                  onChange={(next) =>
                    setOptions((list) => list.map((o) => (o.key === next.key ? next : o)))
                  }
                  onRecommend={() => recommend(current.key)}
                  onDuplicate={duplicate}
                  onRemove={remove}
                />
              )}
            </div>

            {!mayPriceHere && <p className={styles.hint}>{t('portalPricingOff')}</p>}
          </div>

          <div className={styles.side}>
            <PublishPanel
              options={options}
              publicationMode={data.publicationMode}
              publishedAt={data.publishedAt}
              customerName={data.customerName}
              blocking={blocking}
              advisory={advisory}
              awaitingApproval={needsApproval && data.status !== 'approved'}
              mayApprove={!data.pricedByMe}
              mayPrice={editable}
              dirty={dirty}
              saved={saved}
              busy={busy}
              failure={failure ? failure.message || t('unavailable') : null}
              onSave={save}
              onApprove={() => approve.mutateAsync(data.id)}
              onSendBack={() => setSendingBack(true)}
              onPublish={() => setPublishing(true)}
              onDuplicate={duplicate}
              onRemove={remove}
              openIndex={open}
              removable={options.length > 1}
            />

            <SendChecks checks={checks} muted={heldByOther} />

            <CustomerPreview
              option={current}
              number={open + 1}
              originCode={data.originCode}
              destinationCode={data.destinationCode}
              disclosesCarrier={data.disclosesCarrier}
            />

            <MessagePanel value={message} onChange={setMessage} disabled={!editable} />
          </div>
        </div>
      </div>

      {/*
        The assistant, docked bottom right - the same window, in the same place,
        as the one a customer talks to. Outside the rail because it is fixed to
        the viewport, and a fixed child of a scrolling column is a helper that
        scrolls away from the work it is helping with.
      */}
      {aiAssistEnabled && (
        <PricingPanel
          quoteId={data.id}
          onOptions={applyAssistOptions}
          onMessage={setMessage}
          onAnswer={applyAssistAnswer}
          draft={assistDraft}
          outstanding={checks.filter((check) => !check.met).map((check) => t(`check_${check.key}`))}
          editable={editable}
        />
      )}

      {showingRequest && (
        <StaffRequestDrawer
          data={data}
          extra={extra}
          common={common}
          onClose={() => setShowingRequest(false)}
        />
      )}

      {forcing && (
        <ReasonDialog
          title={t('forceReleaseTitle', { name: data.claimedByName ?? t('queueSomeone') })}
          warning={t('forceReleaseWarning', { name: data.claimedByName ?? t('queueSomeone') })}
          confirmLabel={t('forceRelease')}
          pending={forceRelease.isPending}
          onCancel={() => setForcing(false)}
          onConfirm={async (reason) => {
            await forceRelease.mutateAsync({ id: data.id, reason });
            setForcing(false);
          }}
        />
      )}

      {sendingBack && (
        <ReasonDialog
          title={t('sendBackTitle')}
          warning={t('sendBackWarning', { name: data.pricedByName ?? t('queueSomeone') })}
          confirmLabel={t('sendBack')}
          pending={sendBack.isPending}
          onCancel={() => setSendingBack(false)}
          onConfirm={async (reason) => {
            await sendBack.mutateAsync({ id: data.id, reason });
            setSendingBack(false);
          }}
        />
      )}

      {publishing && (
        <PublishDialog
          reference={data.reference}
          publicationMode={data.publicationMode}
          optionCount={options.length}
          pending={publish.isPending}
          onCancel={() => setPublishing(false)}
          onConfirm={async () => {
            await publish.mutateAsync(data.id);
            setPublishing(false);
          }}
        />
      )}
    </section>
  );
}

/** Anything that takes something away from a colleague asks why, and records it. */
function ReasonDialog({
  title, warning, confirmLabel, pending, onCancel, onConfirm,
}: {
  title: string; warning: string; confirmLabel: string; pending: boolean;
  onCancel: () => void; onConfirm: (reason: string) => void;
}) {
  const { t } = useTranslation('staff');
  const [reason, setReason] = useState('');

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{title}</DialogTitle>
        </DrawerHeader>
        <DrawerBody>
          <DrawerCard>
            <p className={styles.dialogText}>{warning}</p>
            <Input
              label={t('forceReleaseReason')}
              hint={t('forceReleaseReasonHint')}
              maxLength={400}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </DrawerCard>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
          <Button onClick={() => onConfirm(reason)} disabled={reason.trim().length < 3 || pending}>
            {confirmLabel}
          </Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Publishing is the one irreversible-feeling act on this screen, so it asks once
 * and says plainly what will happen - including that the customer is emailed.
 */
function PublishDialog({
  reference, publicationMode, optionCount, pending, onCancel, onConfirm,
}: {
  reference: string; publicationMode: string; optionCount: number;
  pending: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const { t } = useTranslation('staff');

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent side="right" closeLabel={t('close')}>
        <DrawerHeader>
          <DialogTitle>{t('publishTitle', { reference })}</DialogTitle>
        </DrawerHeader>
        <DrawerBody>
          <DrawerCard>
            <ul className={styles.publishList}>
              <li>{t('publishWhatCustomer', { count: optionCount })}</li>
              <li>{t('publishWhatEmail')}</li>
              <li>{t(publicationMode === 'cw1' ? 'publishWhatCw1' : 'publishWhatDirect')}</li>
            </ul>
            <p className={styles.dialogText}>{t('publishReversible')}</p>
          </DrawerCard>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
          <Button onClick={onConfirm} disabled={pending}>{t('publish')}</Button>
        </DrawerFooter>
      </DialogContent>
    </Dialog>
  );
}
