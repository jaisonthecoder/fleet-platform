import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AssistantBadge,
  AssistantChoices,
  AssistantDock,
  AssistantQuickAction,
  AssistantSay,
  Button,
  type AssistantTurn,
} from '../../design-system';

import { readFileAsBase64 } from './api/aiIntake';
import {
  requestAssist,
  type AssistDraftOption,
  type AssistOption,
  type AssistQuestion,
  type AssistResult,
} from './api/aiPricing';

export interface PricingPanelProps {
  quoteId: string;
  /** `current` rewrites the option on screen; `new` adds one to the end. */
  onOptions: (options: AssistOption[], target: 'current' | 'new') => void;
  /** A covering note draft, dropped into the message panel for editing. */
  onMessage: (message: string) => void;
  /** An answer to one question, written into the option it names. */
  onAnswer: (question: AssistQuestion, value: string) => void;
  /** What the editor holds now, so a note can mention it. Never used to price. */
  draft: AssistDraftOption[];
  /** The send checks still outstanding. The agent never decides this for itself. */
  outstanding: string[];
  /** False while the quote is held by someone else, or already published. */
  editable: boolean;
}

type Phase = 'idle' | 'working' | 'confirming' | 'asking' | 'offering' | 'ready' | 'failed';

/** The assistant knows three option shapes, and offers them one at a time. */
const MAX_OPTIONS = 3;

interface Attachment {
  name: string;
  mimeType: string;
  dataBase64: string;
}

const newId = () => crypto.randomUUID();

/**
 * Pricing-desk agent, demo scope.
 *
 * The same conversation as the quote-request agent, in the same window: a pricer
 * who has seen the customer side should not have to learn a second thing, so both
 * speak through `AssistantDock` and only the business differs. This one reads what
 * a CARRIER sent and proposes options; the other reads what a CUSTOMER sent and
 * proposes a request.
 *
 * It never proposes a rate of its own. Where a figure appears it was written in
 * the reply the pricer pasted, and it is shown before it lands.
 */
export function PricingPanel({
  quoteId, onOptions, onMessage, onAnswer, draft, outstanding, editable,
}: PricingPanelProps) {
  const { t, i18n } = useTranslation('staff');
  const briefed = useRef(false);

  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  // Closed until asked for: the pricer's own workspace is the thing on screen.
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<AssistQuestion[]>([]);
  const [current, setCurrent] = useState<AssistQuestion | null>(null);
  const [pending, setPending] = useState<AssistResult | null>(null);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [model, setModel] = useState<string | null>(null);
  /** How many options the assistant itself has built, not how many exist. */
  const [built, setBuilt] = useState(0);

  const working = phase === 'working';

  const say = (message: string) =>
    setTurns((all) => [...all, { id: newId(), role: 'agent', kind: 'say', text: message }]);

  /** The opening brief runs no model, so it costs nothing and cannot fail. */
  useEffect(() => {
    if (briefed.current) return;
    briefed.current = true;

    void (async () => {
      try {
        const result = await requestAssist(quoteId, { want: 'brief', locale: i18n.language });
        if (result.status !== 'ready') {
          say(t('aiGreetingPricing'));
          return;
        }
        setTurns(result.say.map((line) => ({ id: newId(), role: 'agent', kind: 'say', text: line })));
      } catch {
        say(t('aiGreetingPricing'));
      }
    })();
    // The ref guard makes a re-run a no-op, so the brief is fetched once per quote
    // however often the language or the translator identity changes.
  }, [quoteId, i18n.language, t]);

  /**
   * `total` is how many options the quote holds once this batch has landed, not
   * how many the assistant built. A pricer who added a third option themselves
   * and asked to have it filled has three, and being offered "a second" is the
   * assistant talking about its own bookkeeping instead of their quote.
   */
  const askNext = (remaining: AssistQuestion[], total = draft.length) => {
    const [next, ...rest] = remaining;

    if (!next) {
      setCurrent(null);
      setQueue([]);
      // Room for another shape, so offer rather than declaring itself finished.
      if (total > 0 && total < MAX_OPTIONS) {
        setPhase('offering');
        say(t('aiOfferAnother', { ordinal: t(`aiOrdinal_${total + 1}`) }));
        return;
      }
      setPhase('ready');
      return;
    }

    setCurrent(next);
    setQueue(rest);
    setPhase('asking');
    say(next.ask);
  };

  /** A read-back of each option, in the customer's own terms. */
  const summarise = (options: AssistOption[]) =>
    options.map((option, index) => {
      const bits = [
        option.carrierName,
        option.transitDaysMin === '' && option.transitDaysMax === ''
          ? null
          : t('aiTransitDays', {
              days:
                option.transitDaysMin === option.transitDaysMax
                  ? option.transitDaysMin
                  : `${option.transitDaysMin || '?'}-${option.transitDaysMax || '?'}`,
            }),
        t('aiLineCount', { count: option.lines.length }),
      ].filter(Boolean);

      return {
        label: option.name.trim() || t('aiOptionNumbered', { number: index + 1 }),
        value: bits.join(' · '),
      };
    });

  const run = async (
    intent: 'scaffold' | 'reply' | 'message',
    spoken: string,
    sent: Attachment | null,
    options: { target?: 'current' | 'new'; fill?: boolean } = {},
  ) => {
    setTurns((all) => [...all, { id: newId(), role: 'user', kind: 'say', text: spoken }]);
    setText('');
    setAttachment(null);
    setPhase('working');

    try {
      const result = await requestAssist(quoteId, {
        want: intent,
        // One at a time: the pricer is asked before a second one is built.
        count: intent === 'scaffold' ? 1 : undefined,
        target: intent === 'scaffold' ? options.target ?? 'current' : undefined,
        existing: intent === 'scaffold' ? built : undefined,
        fill: intent === 'scaffold' ? options.fill : undefined,
        text: intent === 'reply' && text.trim() !== '' ? text.trim() : undefined,
        file: sent ? { mimeType: sent.mimeType, dataBase64: sent.dataBase64 } : undefined,
        locale: i18n.language,
        draft: intent === 'message' ? draft : undefined,
      });

      if (result.status !== 'ready') {
        setPhase('failed');
        say(result.status === 'not-configured' ? t('aiNotConfigured') : t('aiUnreadableReply'));
        return;
      }

      setModel(result.provenance.model ?? null);

      const read = summarise(result.options);
      const reasons = result.derived.map((entry) => entry.text);

      setTurns((all) => [
        ...all,
        ...result.say.map((line) => ({
          id: newId(), role: 'agent' as const, kind: 'say' as const, text: line,
        })),
        ...(read.length > 0
          ? [{ id: newId(), role: 'agent' as const, kind: 'facts' as const, items: read }]
          : []),
        ...(reasons.length > 0
          ? [{ id: newId(), role: 'agent' as const, kind: 'reasoning' as const, items: reasons }]
          : []),
        { id: newId(), role: 'agent', kind: 'say', text: t('aiConfirmAskPricing') },
      ]);

      // Nothing reaches the editor until the pricer says so.
      setPending(result);
      setPhase('confirming');
    } catch {
      setPhase('failed');
      say(t('aiUnreadableReply'));
    }
  };

  const applyPending = () => {
    if (!pending) return;

    if (pending.options.length > 0) onOptions(pending.options, pending.target);
    if (pending.message) onMessage(pending.message);

    setTurns((all) => [
      ...all,
      { id: newId(), role: 'user', kind: 'say', text: t('aiApply') },
      {
        id: newId(),
        role: 'agent',
        kind: 'say',
        text: pending.indicative ? t('aiAppliedIndicative') : t('aiAppliedPricing'),
      },
    ]);

    const questions = pending.questions;
    // `draft` is still the pre-apply list, so only a new option grows the count.
    const total = pending.target === 'new' ? draft.length + 1 : draft.length;
    setBuilt((count) => count + pending.options.length);
    setPending(null);
    askNext(questions, total);
  };

  /** Yes to "shall I add another": one more shape, same charges, a new option. */
  const acceptOffer = () => {
    void run('scaffold', t('aiYes'), null, { target: 'new', fill: true });
  };

  const declineOffer = () => {
    setTurns((all) => [
      ...all,
      { id: newId(), role: 'user', kind: 'say', text: t('aiNoThanks') },
    ]);
    setPhase('ready');
  };

  const discardPending = () => {
    setTurns((all) => [
      ...all,
      { id: newId(), role: 'user', kind: 'say', text: t('aiDiscard') },
      { id: newId(), role: 'agent', kind: 'say', text: t('aiDiscarded') },
    ]);
    setPending(null);
    setPhase('idle');
  };

  const sendAnswer = () => {
    const answer = text.trim();
    if (answer === '' || !current) return;

    setTurns((all) => [...all, { id: newId(), role: 'user', kind: 'say', text: answer }]);
    setText('');
    onAnswer(current, answer);
    askNext(queue);
  };

  const submit = () => {
    if (phase === 'asking' && current && attachment === null) {
      sendAnswer();
      return;
    }
    if (working || phase === 'confirming') return;
    if (text.trim() === '' && attachment === null) return;
    void run('reply', text.trim() || t('aiSentReply', { name: attachment?.name ?? '' }), attachment);
  };

  const onFile = async (file: File) => {
    const encoded = await readFileAsBase64(file);
    setAttachment({ name: file.name, ...encoded });
  };

  const busy = working || phase === 'confirming' || phase === 'offering' || !editable;

  const placeholder =
    phase === 'asking' && current ? t('aiAnswerPlaceholder') : t('aiReplyPlaceholder');

  return (
    <AssistantDock
      title={t('aiTitlePricing')}
      minimiseLabel={t('aiMinimise')}
      open={open}
      onOpenChange={setOpen}
      turns={turns}
      reasoningLabel={t('aiWhy')}
      working={working}
      workingSteps={[
        t('aiStepReadingReply'),
        t('aiStepMatching'),
        t('aiStepBuilding'),
        t('aiStepChecking'),
      ]}
      badge={
        phase === 'ready' && outstanding.length === 0 ? <AssistantBadge>{t('aiDone')}</AssistantBadge> : undefined
      }
      footer={
        <>
          {phase === 'confirming' && (
            <AssistantChoices>
              <Button size="sm" onClick={applyPending}>
                {t('aiApply')}
              </Button>
              <Button size="sm" variant="outline" onClick={discardPending}>
                {t('aiDiscard')}
              </Button>
            </AssistantChoices>
          )}

          {phase === 'offering' && (
            <AssistantChoices>
              <Button size="sm" onClick={acceptOffer}>
                {t('aiYes')}
              </Button>
              <Button size="sm" variant="outline" onClick={declineOffer}>
                {t('aiNoThanks')}
              </Button>
            </AssistantChoices>
          )}

          {/* Read from the editor on every render, so it cannot claim to be finished
              while a send check is still red, and it corrects itself as the pricer
              types. */}
          {phase === 'ready' && (
            <AssistantSay>
              {outstanding.length === 0
                ? t('aiReadyPricing')
                : t('aiStillNeed', { list: outstanding.join(', ') })}
            </AssistantSay>
          )}
        </>
      }
      /* What it can do without being given anything to read. "Fill" rewrites the
         option on screen; "new" is the only thing that grows the list. */
      quickActions={
        <>
          <AssistantQuickAction
            disabled={busy}
            onClick={() => void run('scaffold', t('aiAskFill'), null, { target: 'current', fill: true })}
          >
            {t('aiActionFill')}
          </AssistantQuickAction>
          <AssistantQuickAction
            disabled={busy || built >= MAX_OPTIONS}
            onClick={() => void run('scaffold', t('aiAskNewOption'), null, { target: 'new', fill: true })}
          >
            {t('aiActionNewOption')}
          </AssistantQuickAction>
          <AssistantQuickAction
            disabled={busy}
            onClick={() => void run('scaffold', t('aiAskScaffold'), null, { target: 'current' })}
          >
            {t('aiActionScaffold')}
          </AssistantQuickAction>
          <AssistantQuickAction
            disabled={busy || draft.length === 0}
            onClick={() => void run('message', t('aiAskMessage'), null)}
          >
            {t('aiActionMessage')}
          </AssistantQuickAction>
        </>
      }
      value={text}
      onValueChange={setText}
      onSubmit={submit}
      composerLabel={t('aiReplyLabel')}
      placeholder={placeholder}
      inputDisabled={busy}
      attachLabel={t('aiUploadReply')}
      attachDisabled={busy}
      onAttach={(file) => void onFile(file)}
      attachment={
        attachment
          ? {
              name: attachment.name,
              removeLabel: t('aiRemoveAttachment', { name: attachment.name }),
              onRemove: () => setAttachment(null),
            }
          : null
      }
      sendLabel={t('aiSend')}
      sendDisabled={busy || text.trim() === ''}
      note={model ? t('aiProvenancePricing') : undefined}
    />
  );
}
