import { forwardRef, useId, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { Slider } from '../../primitives/slider';
import { clampProgress } from '../../measure';
import { cn } from '../../utils';
import styles from './ContainerSelector.module.css';

export interface ContainerSelectorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Names the whole card for assistive technology, e.g. "40 ft high cube". */
  label: string;
  /** Shown on the drawn container face, e.g. "40' HC". */
  code: ReactNode;
  /** e.g. "12.03 × 2.35 × 2.69 m". */
  dimensions: ReactNode;
  /** e.g. "76 m³ · 25 EU pallets". */
  capacity?: ReactNode;

  count: number;
  onCountChange: (count: number) => void;
  maxCount?: number;
  countLabel: string;
  decrementLabel: string;
  incrementLabel: string;

  payload: number;
  payloadLimit: number;
  onPayloadChange: (payload: number) => void;
  /** e.g. "Gross each". */
  payloadLabel: string;
  payloadStep?: number;
  /**
   * The unit shown after the field, e.g. "kg". Presentation only — the value
   * itself is always a plain number, because a field holding "17,100 kg" is a
   * field nobody can type into.
   */
  payloadUnit?: ReactNode;
  /** Largest value the field will accept. Defaults to twice the limit, so an
   *  over-payload request is still expressible and still warned about. */
  payloadMax?: number;
  /** e.g. "61% of 28,000 kg". */
  payloadNote?: ReactNode;
  /** What a screen reader announces for the slider, e.g. "17,100 of 28,000 kg". */
  payloadValueText?: string;

  /**
   * Fraction of the limit at which the meter turns to the action colour.
   * This is commercial policy, not presentation, so it arrives as a prop and
   * carries the kit's value only as a default.
   */
  warnAt?: number;
  /** Shown as text when the payload is over the threshold, so colour is never the only signal. */
  overLabel?: ReactNode;

  selected?: boolean;
  disabled?: boolean;
}

/**
 * SE-04 · Container selector.
 *
 * A drawn container face, a stepper, and a payload slider whose meter turns
 * from success green to the action colour past the threshold.
 *
 * The payload block stays mounted once it has appeared: unmounting it discarded
 * whatever the user had entered and dropped focus to the document body.
 */
export const ContainerSelector = forwardRef<HTMLDivElement, ContainerSelectorProps>(
  function ContainerSelector(
    {
      label,
      code,
      dimensions,
      capacity,
      count,
      onCountChange,
      maxCount = Number.MAX_SAFE_INTEGER,
      countLabel,
      decrementLabel,
      incrementLabel,
      payload,
      payloadLimit,
      onPayloadChange,
      payloadLabel,
      payloadStep = 500,
      payloadUnit,
      payloadMax,
      payloadNote,
      payloadValueText,
      warnAt = 0.95,
      overLabel,
      selected = count > 0,
      disabled = false,
      className,
      ...rest
    },
    ref,
  ) {
    const id = useId();
    const meter = clampProgress(payload, payloadLimit);
    const over = payload > payloadLimit * warnAt;
    const chosen = count > 0;
    const ceiling = payloadMax ?? payloadLimit * 2;

    /*
     * The field holds a draft while it is being typed.
     *
     * Without it, clearing the field to retype sends 0 up, the prop comes back
     * as 0, and the field refills with "0" mid-keystroke — so the weight can
     * only ever be corrected by selecting the text first. The draft lets the
     * field be empty while the value it reports stays a number.
     */
    const [draft, setDraft] = useState<string | null>(null);
    const shown = draft ?? (payload > 0 ? String(payload) : '');

    const type = (next: string) => {
      // Digits only: this is a weight, and a field that accepts "12e4" or "-3"
      // has to explain itself later.
      const cleaned = next.replace(/[^\d]/g, '').slice(0, 9);
      setDraft(cleaned);
      const parsed = cleaned === '' ? 0 : Number(cleaned);
      onPayloadChange(Math.min(parsed, ceiling));
    };

    return (
      <div
        ref={ref}
        role="group"
        aria-label={label}
        aria-disabled={disabled || undefined}
        data-selected={selected || undefined}
        data-over={over || undefined}
        className={cn(styles.card, className)}
        {...rest}
      >
        {/* The face is decoration: the code is read from the text below it. */}
        <div className={styles.face} aria-hidden="true">
          <span className={styles.post} />
          <span className={styles.ribs} />
          <span className={styles.code}>{code}</span>
          <span className={styles.post} />
        </div>

        <p className={styles.dimensions}>
          <span className="noa-visually-hidden">{label}. </span>
          {dimensions}
        </p>
        {capacity && <p className={styles.capacity}>{capacity}</p>}

        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.step}
            aria-label={decrementLabel}
            disabled={disabled || count <= 0}
            onClick={() => onCountChange(Math.max(0, count - 1))}
          >
            <span aria-hidden="true">&minus;</span>
          </button>
          <output className={styles.count} aria-live="polite">
            <span className="noa-visually-hidden">{countLabel}: </span>
            {count}
          </output>
          <button
            type="button"
            className={styles.step}
            aria-label={incrementLabel}
            disabled={disabled || count >= maxCount}
            onClick={() => onCountChange(Math.min(maxCount, count + 1))}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>

        {/* Stays in the tree once chosen, disabled rather than removed. */}
        {chosen && (
          <div className={styles.payload}>
            <div className={styles.payloadHead}>
              <label id={`${id}-payload`} htmlFor={`${id}-weight`}>
                {payloadLabel}
              </label>

              {/* Typing and dragging are the same value: a customer who knows
                  the figure types it, and one who is estimating drags. */}
              <span className={styles.entry}>
                <input
                  id={`${id}-weight`}
                  className={styles.weight}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={disabled}
                  value={shown}
                  aria-describedby={payloadUnit ? `${id}-unit` : undefined}
                  onChange={(event) => type(event.target.value)}
                  onFocus={(event) => event.target.select()}
                  // The draft is only the truth while it is being typed. Dropping
                  // it on blur is what lets the slider, a shortcut or a reset
                  // show through afterwards.
                  onBlur={() => setDraft(null)}
                />
                {payloadUnit && (
                  <span className={styles.unit} id={`${id}-unit`}>
                    {payloadUnit}
                  </span>
                )}
              </span>
            </div>

            <Slider
              className={styles.slider}
              value={[meter.value]}
              min={0}
              max={meter.max}
              step={payloadStep}
              disabled={disabled}
              thumbLabel={payloadLabel}
              thumbValueText={payloadValueText}
              onValueChange={([next]) => {
                setDraft(null);
                onPayloadChange(next ?? 0);
              }}
            />

            <div className={styles.meter} aria-hidden="true">
              <span style={{ '--fill': `${meter.percent}%` } as CSSProperties} />
            </div>

            {(payloadNote || (over && overLabel)) && (
              <p className={styles.note}>
                {payloadNote}
                {over && overLabel && <strong className={styles.over}> {overLabel}</strong>}
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);
