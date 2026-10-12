import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, Minus, Paperclip, Send, Sparkles, X } from 'lucide-react';

import { Button } from '../Button';
import styles from './AssistantDock.module.css';

/** One thing that has been said, or worked out, in the conversation. */
export type AssistantTurn =
  | { id: string; role: 'agent'; kind: 'say'; text: string }
  | { id: string; role: 'agent'; kind: 'facts'; items: { label: string; value: string }[] }
  | { id: string; role: 'agent'; kind: 'reasoning'; items: string[] }
  | { id: string; role: 'user'; kind: 'say'; text: string };

/** A file staged in the composer, waiting to be sent. */
export interface AssistantAttachment {
  name: string;
  onRemove: () => void;
  /** Accessible name of the remove control, e.g. "Remove rates.pdf". */
  removeLabel: string;
}

export interface AssistantDockProps {
  /** Names the window, and labels the launcher it collapses to. */
  title: string;
  /** Accessible name and tooltip of the minimise control. */
  minimiseLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;

  turns: AssistantTurn[];
  /** Heading over a reasoning turn's list, e.g. "Why". */
  reasoningLabel: string;
  /**
   * True while the agent is thinking. The dock walks `workingSteps` on its own:
   * a wait that names what is happening reads as progress rather than a stall,
   * and the stages are a presentation choice, not something a caller tracks.
   */
  working?: boolean;
  workingSteps?: string[];
  /** Ends the thread: confirm buttons, an offer, a verdict line. */
  footer?: ReactNode;
  /** A badge on the title bar - "ready to send", usually. */
  badge?: ReactNode;

  /** Offers that need nothing typed first, above the box. */
  quickActions?: ReactNode;

  value: string;
  onValueChange: (value: string) => void;
  /** Enter, or the send button. */
  onSubmit: () => void;
  /** Invisible label on the text box: every field has a name. */
  composerLabel: string;
  placeholder?: string;
  inputDisabled?: boolean;

  attachLabel: string;
  /** Defaults to the documents the agents can read. */
  attachAccept?: string;
  attachDisabled?: boolean;
  onAttach: (file: File) => void;
  /** When set, the chip replaces the attach button: one file at a time. */
  attachment?: AssistantAttachment | null;

  sendLabel: string;
  sendDisabled?: boolean;
  /** A quiet line before the send button - model provenance, usually. */
  note?: ReactNode;
}

/**
 * An agent bubble for a line that is worked out at render time.
 *
 * Kept out of `turns`, which is a record of what was said: a verdict read from
 * the form on every render ("still needed: cargo") must be free to correct
 * itself as the form changes, and a turn that rewrites itself is not a turn.
 */
export function AssistantSay({ children }: { children: ReactNode }) {
  return <p className={styles.agent}>{children}</p>;
}

/** A row of answers to what the agent just asked, inside the thread. */
export function AssistantChoices({ children }: { children: ReactNode }) {
  return <div className={styles.choices}>{children}</div>;
}

/** The title bar's verdict: the agent believes there is nothing left to do. */
export function AssistantBadge({ children }: { children: ReactNode }) {
  return (
    <span className={styles.badge}>
      <Check size={13} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Something the agent can do without being handed anything to read first. */
export function AssistantQuickAction({
  children,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.quickAction} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

const DEFAULT_ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
/** Roughly a read of one stage's worth of text before the next is claimed. */
const STAGE_MS = 1100;

/**
 * The window an assistant talks to you through.
 *
 * Pure chrome, and deliberately so: it holds the dock, the launcher, the thread,
 * the composer and the scrolling, and it knows nothing about quotes, rates or
 * what any of the turns mean. Two agents - one reading what a customer sent, one
 * reading what a carrier sent - have nothing in common as businesses and
 * everything in common as a conversation, so this is the part they share.
 *
 * Fixed bottom-right because it is a helper you turn to, not a step you pass
 * through. In a column it pushes the work being done off the top of the screen;
 * docked, it collapses to a launcher and gives the page back.
 *
 * Every string arrives as a prop. The kit carries no copy, and these two speak
 * to different people - a customer and a pricing desk - about different things.
 */
export function AssistantDock({
  title,
  minimiseLabel,
  open,
  onOpenChange,
  turns,
  reasoningLabel,
  working = false,
  workingSteps = [],
  footer,
  badge,
  quickActions,
  value,
  onValueChange,
  onSubmit,
  composerLabel,
  placeholder,
  inputDisabled = false,
  attachLabel,
  attachAccept = DEFAULT_ACCEPT,
  attachDisabled = false,
  onAttach,
  attachment = null,
  sendLabel,
  sendDisabled = false,
  note,
}: AssistantDockProps) {
  const textId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const endOfThread = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);

  // The newest turn is the one being read, so the thread follows it down.
  useEffect(() => {
    if (!open) return;
    endOfThread.current?.scrollIntoView({ block: 'end' });
  }, [turns, working, open]);

  useEffect(() => {
    if (!working) {
      setStage(0);
      return;
    }
    const timer = setInterval(
      () => setStage((current) => Math.min(current + 1, Math.max(0, workingSteps.length - 1))),
      STAGE_MS,
    );
    return () => clearInterval(timer);
  }, [working, workingSteps.length]);

  if (!open) {
    return (
      <div className={styles.dock}>
        <button type="button" className={styles.launcher} onClick={() => onOpenChange(true)}>
          <Sparkles size={16} aria-hidden="true" />
          {title}
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.dock} ${styles.window}`}>
      <div className={styles.bar}>
        <span className={styles.mark} aria-hidden="true">
          <Sparkles size={14} />
        </span>
        <span className={styles.title}>{title}</span>
        {badge}
        <button
          type="button"
          className={styles.minimise}
          aria-label={minimiseLabel}
          title={minimiseLabel}
          onClick={() => onOpenChange(false)}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.thread} role="log" aria-live="polite">
        {turns.map((turn) => {
          if (turn.role === 'user') {
            return (
              <p key={turn.id} className={styles.user}>
                {turn.text}
              </p>
            );
          }

          if (turn.kind === 'facts') {
            return (
              <dl key={turn.id} className={styles.facts}>
                {turn.items.map((item) => (
                  <div key={item.label} className={styles.fact}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            );
          }

          if (turn.kind === 'reasoning') {
            return (
              <div key={turn.id} className={styles.reasoning}>
                <span className={styles.reasoningLabel}>{reasoningLabel}</span>
                <ul>
                  {turn.items.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            );
          }

          return (
            <p key={turn.id} className={styles.agent}>
              {turn.text}
            </p>
          );
        })}

        {working && workingSteps.length > 0 && (
          <p className={styles.thinking}>
            <span className={styles.dots} aria-hidden="true" />
            {workingSteps[Math.min(stage, workingSteps.length - 1)]}
          </p>
        )}

        {footer}

        <div ref={endOfThread} />
      </div>

      <div className={styles.composer}>
        {quickActions && <div className={styles.quick}>{quickActions}</div>}

        <label className="noa-visually-hidden" htmlFor={textId}>
          {composerLabel}
        </label>
        <textarea
          id={textId}
          className={`noa-control ${styles.textarea}`}
          rows={2}
          placeholder={placeholder}
          value={value}
          disabled={inputDisabled}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line: the habit every chat
            // window has taught, and a two-row box is not a document.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />

        <div className={styles.actions}>
          <input
            ref={fileInput}
            type="file"
            accept={attachAccept}
            className="noa-visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so choosing the same file twice still fires a change.
              event.target.value = '';
              if (file) onAttach(file);
            }}
          />

          {attachment ? (
            <span className={styles.chip}>
              <Paperclip size={13} aria-hidden="true" />
              <span className={styles.chipName}>{attachment.name}</span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={attachment.removeLabel}
                onClick={attachment.onRemove}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={attachDisabled}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={14} aria-hidden="true" /> {attachLabel}
            </Button>
          )}

          <span className={styles.spacer} />

          {note && <span className={styles.note}>{note}</span>}

          <Button size="sm" disabled={sendDisabled} onClick={onSubmit}>
            <Send size={14} aria-hidden="true" /> {sendLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
