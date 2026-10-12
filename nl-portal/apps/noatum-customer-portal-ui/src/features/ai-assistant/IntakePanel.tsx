import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AssistantBadge,
  AssistantChoices,
  AssistantDock,
  AssistantSay,
  Button,
  type AssistantTurn,
} from '../../design-system';

import { readFileAsBase64, requestIntakeDraft, type IntakeDraft, type IntakeQuestion } from './api/aiIntake';

export interface IntakePanelProps {
  /** Applied to the form. Only fills fields the customer has not already typed. */
  onDraft: (draft: IntakeDraft) => void;
  /** Answering a question writes straight into the matching form field. */
  onAnswer: (question: IntakeQuestion, value: string) => void;
  /** Sections the form still needs. The agent never decides this for itself. */
  outstanding: string[];
}

type Phase = 'idle' | 'working' | 'confirming' | 'asking' | 'ready' | 'failed';

interface Attachment {
  name: string;
  mimeType: string;
  dataBase64: string;
}

const newId = () => crypto.randomUUID();

/** ISO from the model, DD.MM.YYYY on screen. */
function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
}

/**
 * Quote-request agent, demo scope.
 *
 * It holds a conversation: it reads what you send, says what it worked out and
 * why, then asks for what is missing one question at a time. Every value it
 * produces lands in the ordinary form below as an editable draft, and the
 * customer still presses submit.
 *
 * The window it speaks through is `AssistantDock`, shared with the pricing desk's
 * agent. Everything here is the business - what a customer's brief means, what
 * the form still needs - and none of it is chrome.
 */
export function IntakePanel({ onDraft, onAnswer, outstanding }: IntakePanelProps) {
  const { t, i18n } = useTranslation();

  const [turns, setTurns] = useState<AssistantTurn[]>([
    { id: 'greeting', role: 'agent', kind: 'say', text: t('aiGreeting') },
  ]);
  const [phase, setPhase] = useState<Phase>('idle');
  // Closed until asked for: the form is the thing the customer came to fill.
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<IntakeQuestion[]>([]);
  const [current, setCurrent] = useState<IntakeQuestion | null>(null);
  const [pending, setPending] = useState<IntakeDraft | null>(null);
  const [text, setText] = useState('');
  const [model, setModel] = useState<string | null>(null);

  const working = phase === 'working';
  const canSend = !working && text.trim() !== '';

  const say = (text: string) => setTurns((all) => [...all, { id: newId(), role: 'agent', kind: 'say', text }]);

  /** Moves to the next outstanding question, or hands back to the customer. */
  const askNext = (remaining: IntakeQuestion[]) => {
    const [next, ...rest] = remaining;

    if (!next) {
      setCurrent(null);
      setQueue([]);
      setPhase('ready');
      return;
    }

    setCurrent(next);
    setQueue(rest);
    setPhase('asking');
    say(next.ask);
  };

  const summarise = (draft: IntakeDraft) => {
    const items: { label: string; value: string }[] = [];
    const f = draft.fields;

    const str = (key: string) => (typeof f[key] === 'string' ? (f[key] as string).trim() : '');

    const add = (field: string, value: string) => {
      if (value !== '') items.push({ label: t(`aiField_${field}`), value });
    };

    // The code is what the form uses, but the customer wrote a place name, so
    // show whichever we actually have rather than an empty row.
    add('originCode', str('originCode') || str('originText'));
    add('destinationCode', str('destinationCode') || str('destinationText'));
    add('incoterm', str('incoterm'));

    const scope = str('scope');
    if (scope !== '') add('scope', t(`reqScope_${scope}`));

    add('loadType', str('loadType'));
    add('commodity', str('commodity'));
    add('readyDate', formatDate(str('readyDate')));
    add('shipper', str('shipper'));
    add('consignee', str('consignee'));

    const equipment = f.equipment;
    if (Array.isArray(equipment) && equipment.length > 0) {
      const units = equipment as { containerType: string; quantity: number }[];
      items.push({
        label: t('aiField_equipment'),
        value: units.map((u) => `${u.quantity} × ${u.containerType}`).join(', '),
      });
    }

    if (f.dangerousGoods === true) items.push({ label: t('aiField_dangerousGoods'), value: t('aiYes') });
    if (f.temperature === true) items.push({ label: t('aiField_temperature'), value: t('aiYes') });

    return items;
  };

  /**
   * `justAttached` is passed in rather than read from state because attaching a
   * document starts the read immediately, before React has committed it.
   */
  const sendBrief = async (justAttached?: Attachment) => {
    const spoken = text.trim();
    const sent = justAttached;

    setTurns((all) => [
      ...all,
      {
        id: newId(),
        role: 'user',
        kind: 'say',
        text: spoken !== '' ? spoken : t('aiSentDocument', { name: sent?.name ?? '' }),
      },
    ]);

    setText('');
    setPhase('working');

    try {
      const draft = await requestIntakeDraft({
        text: spoken === '' ? undefined : spoken,
        file: sent ? { mimeType: sent.mimeType, dataBase64: sent.dataBase64 } : undefined,
        locale: i18n.language,
      });

      if (draft.status !== 'extracted') {
        setPhase('failed');
        say(draft.status === 'not-configured' ? t('aiNotConfigured') : t('aiUnreadable'));
        return;
      }

      setModel(draft.provenance.model ?? null);

      const facts = summarise(draft);
      const reasons = draft.derived.map((d) => d.text);

      setTurns((all) => [
        ...all,
        { id: newId(), role: 'agent', kind: 'say', text: t('aiHere') },
        ...(facts.length > 0 ? [{ id: newId(), role: 'agent' as const, kind: 'facts' as const, items: facts }] : []),
        ...(reasons.length > 0
          ? [{ id: newId(), role: 'agent' as const, kind: 'reasoning' as const, items: reasons }]
          : []),
        { id: newId(), role: 'agent', kind: 'say', text: t('aiConfirmAsk') },
      ]);

      // Nothing reaches the form until the customer says so.
      setPending(draft);
      setPhase('confirming');
    } catch {
      setPhase('failed');
      say(t('aiUnreadable'));
    }
  };

  const applyPending = () => {
    if (!pending) return;
    onDraft(pending);
    setTurns((all) => [
      ...all,
      { id: newId(), role: 'user', kind: 'say', text: t('aiApply') },
      { id: newId(), role: 'agent', kind: 'say', text: t('aiApplied') },
    ]);
    const questions = pending.questions;
    setPending(null);
    askNext(questions);
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
    if (phase === 'asking' && current) {
      sendAnswer();
      return;
    }
    if (!canSend) return;
    void sendBrief();
  };

  const onFile = async (file: File) => {
    const encoded = await readFileAsBase64(file);
    // Attaching is the instruction. Waiting for a second press reads as a stall.
    void sendBrief({ name: file.name, ...encoded });
  };

  const placeholder =
    phase === 'asking' && current
      ? t('aiAnswerPlaceholder')
      : phase === 'ready'
        ? t('aiMorePlaceholder')
        : t('aiPastePlaceholder');

  return (
    <AssistantDock
      title={t('aiTitle')}
      minimiseLabel={t('aiMinimise')}
      open={open}
      onOpenChange={setOpen}
      turns={turns}
      reasoningLabel={t('aiWhy')}
      working={working}
      workingSteps={[t('aiStepReading'), t('aiStepRoute'), t('aiStepEquipment'), t('aiStepChecking')]}
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

          {/* Read from the form on every render, so it cannot claim to be ready
              while a section is still outstanding, and it corrects itself as the
              customer edits. */}
          {phase === 'ready' && (
            <AssistantSay>
              {outstanding.length === 0 ? t('aiReady') : t('aiStillNeed', { list: outstanding.join(', ') })}
            </AssistantSay>
          )}
        </>
      }
      value={text}
      onValueChange={setText}
      onSubmit={submit}
      composerLabel={t('aiPaste')}
      placeholder={placeholder}
      inputDisabled={working}
      attachLabel={t('aiUpload')}
      attachDisabled={working || phase === 'confirming'}
      onAttach={(file) => void onFile(file)}
      sendLabel={t('aiSend')}
      sendDisabled={working || phase === 'confirming' || text.trim() === ''}
      note={model ? t('aiProvenance') : undefined}
    />
  );
}
