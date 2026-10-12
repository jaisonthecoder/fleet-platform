import { forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../utils';
import styles from './Co2Calculator.module.css';

/** The modes the panel can draw. The caller decides which a lane actually serves. */
export type Co2Mode = 'Sea FCL' | 'Sea LCL' | 'Air' | 'Rail' | 'Road';

/*
 * Icons and rail colours are page furniture, not data, so they stay here rather
 * than travelling over the wire. Everything with a number in it arrives as a
 * prop and is calculated by whoever owns the figures.
 */
const MODE_ICON: Record<Co2Mode, string> = {
  'Sea FCL': 'M2 20c2 1 4 1 6-1 2 2 6 2 8 0 2 2 4 2 6 1M4 16l1-5h14l1 5M8 11V7h8v4',
  'Sea LCL': 'M3 8h18v11H3zM3 12h18M9 8V5h6v3',
  Air: 'M2 14l8 1 4 7 2-1-1-7 6-3c1-1 1-2 0-3l-7 2-5-5-2 1 3 6-8 1z',
  Rail: 'M6 3h12v13H6zM9 16l-2 5M15 16l2 5M6 9h12',
  Road: 'M3 16V9h11v7M14 11h4l3 3v2h-7M6.5 19a1.6 1.6 0 1 0 0-3.2M17.5 19a1.6 1.6 0 1 0 0-3.2',
};

const RAILS = ['var(--color-primary)', 'var(--noa-mint-400)', 'var(--noa-amber-400)'];

export interface Co2Place {
  id: string;
  label: string;
}

export interface Co2Preset {
  id: string;
  label: string;
  tonnes: number;
}

export interface Co2ModeResult {
  mode: Co2Mode;
  /** Already formatted, e.g. "5,386 kg". The caller owns rounding and locale. */
  label: string;
  /** 0–1 of the worst mode on the lane, for the bar width. */
  share: number;
}

export interface Co2Fact {
  key: string;
  value: ReactNode;
  sub: ReactNode;
}

export interface Co2CalculatorLabels {
  title: string;
  blurb: ReactNode;
  origin: string;
  destination: string;
  mode: string;
  weight: string;
  tonnes: string;
  basis: ReactNode;
  /** e.g. "ESTIMATED EMISSIONS · SEA FCL". */
  estimated: string;
  unit: string;
  compare: string;
  disclaimer: ReactNode;
  /** Announced on a mode the lane does not serve. */
  unservedMode: (mode: string) => string;
}

export interface Co2CalculatorProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  labels: Co2CalculatorLabels;

  /*
   * The two ends, chosen separately.
   *
   * A single "lane" select made the customer hunt for a pair somebody else had
   * already written down, and it matched nothing else in the product — the
   * quote form asks for an origin and a destination, so this does too. The
   * caller decides which destinations a chosen origin can reach.
   */
  origins: readonly Co2Place[];
  originId: string;
  onOriginChange: (id: string) => void;
  destinations: readonly Co2Place[];
  destinationId: string;
  onDestinationChange: (id: string) => void;

  /** Every mode the panel offers, in order. Unserved ones are dimmed. */
  modes: readonly Co2Mode[];
  /** Modes this pair is actually served by. Everything else is drawn inert. */
  servedModes: readonly Co2Mode[];
  mode: Co2Mode;
  onModeChange: (mode: Co2Mode) => void;
  /** Held as text, so a half-typed "1." is not rewritten under the cursor. */
  tonnes: string;
  onTonnesChange: (tonnes: string) => void;
  presets?: readonly Co2Preset[];

  /** The headline figure, already formatted. `null` while there is none. */
  total: string | null;
  /** The line under it, e.g. "34 t · 19,800 km · Qingdao to Valencia". */
  detail: ReactNode;
  facts: readonly Co2Fact[];
  byMode: readonly Co2ModeResult[];
  /** The mode that emits most on this lane, drawn in the action colour. */
  worstMode?: Co2Mode;
  /** One sentence under the bars, e.g. "Air would emit about 30x more." */
  comparison: ReactNode;
  /** True while a new figure is in flight; the old one stays on screen. */
  busy?: boolean;
  /**
   * `compact` tightens the air and the type for a sidebar. Nothing is dropped:
   * the comparison is the point of the panel, and a figure with nothing to be
   * measured against is just a number.
   */
  density?: 'default' | 'compact';

  /** The call to action in the foot. Omit it and nothing is drawn. */
  action?: ReactNode;
}

/**
 * SP-09 · CO2e calculator.
 *
 * Compare transport modes on one lane: pick the lane, the mode and the weight,
 * and read the estimate against every other mode the lane is served by.
 *
 * Presentation only, and deliberately so. It calculates nothing and fetches
 * nothing — every figure arrives formatted, because a number a customer sees
 * must have exactly one implementation and it is the server's. A copy of the
 * arithmetic in the browser is how the figure on this panel ends up disagreeing
 * with the figure on the quotation.
 *
 * That is also what lets it sit on a public page: it reads and writes nothing
 * about the visitor.
 */
export const Co2Calculator = forwardRef<HTMLElement, Co2CalculatorProps>(function Co2Calculator(
  {
    labels,
    origins,
    originId,
    onOriginChange,
    destinations,
    destinationId,
    onDestinationChange,
    modes,
    servedModes,
    mode,
    onModeChange,
    tonnes,
    onTonnesChange,
    presets = [],
    total,
    detail,
    facts,
    byMode,
    worstMode,
    comparison,
    busy,
    density = 'default',
    action,
    className,
    ...rest
  },
  ref,
) {
  const id = useId();

  return (
    <section
      ref={ref}
      className={cn(styles.card, className)}
      data-density={density === 'compact' ? 'compact' : undefined}
      aria-labelledby={`${id}-title`}
      {...rest}
    >
      <div className={styles.head}>
        <div className={styles.headLede}>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round">
                <path d="M5 20c0-8 5-13 14-14-1 9-6 14-14 14z" />
                <path d="M5 20l8-8" />
              </svg>
            </span>
            <h2 id={`${id}-title`} className={styles.title}>
              {labels.title}
            </h2>
          </div>
          <p className={styles.blurb}>{labels.blurb}</p>
        </div>
        <span className={styles.rule} aria-hidden="true" />
      </div>

      <div className={styles.body}>
        {/* aria-busy rather than a spinner: the previous estimate stays on
            screen while a new one is calculated, so nothing jumps. */}
        <div className={styles.result} aria-busy={busy || undefined}>
          {/*
            Everything that changes the figure is on the dark surface with it,
            in one column: where it goes, how it travels, how much of it. The
            reading sits in the other column, so the panel is one object you
            work down the left of and read down the right.
          */}
          <div className={styles.controls}>
            {/* Two ends, one question — the arrow carries the relationship
                without needing a third control to explain it. */}
            <div className={styles.route}>
              <div className={styles.routeEnd}>
                <label className={styles.darkLabel} htmlFor={`${id}-origin`}>
                  {labels.origin}
                </label>
                <select
                  id={`${id}-origin`}
                  className={styles.select}
                  value={originId}
                  onChange={(event) => onOriginChange(event.target.value)}
                >
                  {origins.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              <span className={styles.routeArrow} aria-hidden="true">
                →
              </span>

              <div className={styles.routeEnd}>
                <label className={styles.darkLabel} htmlFor={`${id}-destination`}>
                  {labels.destination}
                </label>
                <select
                  id={`${id}-destination`}
                  className={styles.select}
                  value={destinationId}
                  onChange={(event) => onDestinationChange(event.target.value)}
                >
                  {destinations.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.modeRow}>
              <span className={styles.darkLabel} id={`${id}-mode`}>
                {labels.mode}
              </span>
              <div className={styles.modes} role="group" aria-labelledby={`${id}-mode`}>
                {modes.map((candidate) => {
                  // A mode nobody runs on this pair is shown, not hidden: "air
                  // does not serve this lane" is the information, and a chip
                  // that disappears teaches nothing.
                  const served = servedModes.includes(candidate);
                  return (
                    <button
                      key={candidate}
                      type="button"
                      className={styles.mode}
                      aria-pressed={served && candidate === mode}
                      disabled={!served}
                      title={served ? undefined : labels.unservedMode(candidate)}
                      onClick={() => onModeChange(candidate)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d={MODE_ICON[candidate]} />
                      </svg>
                      {candidate}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Raised off the dark surface, because it is the one field here
                and the whole figure moves with it. */}
            <div className={styles.weightBlock}>
              <label className={styles.darkLabel} htmlFor={`${id}-weight`}>
                {labels.weight}
              </label>
              <div className={styles.weight}>
                <input
                  id={`${id}-weight`}
                  type="number"
                  min="0.1"
                  step="0.1"
                  inputMode="decimal"
                  value={tonnes}
                  onChange={(event) => onTonnesChange(event.target.value)}
                />
                <span className={styles.unit}>{labels.tonnes}</span>
              </div>
              {presets.length > 0 && (
                <div className={styles.presets}>
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={styles.preset}
                      onClick={() => onTonnesChange(String(preset.tonnes))}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* What the figure rests on, kept with the controls that produced
                it rather than under the number it qualifies. */}
            <p className={styles.basis}>{labels.basis}</p>
          </div>

          <div className={styles.readout}>
            <div className={styles.resultTop}>
              <div className={styles.headline}>
                <p className={styles.capLabel}>{labels.estimated}</p>
                {/* One accessible name, so a screen reader does not read the
                  figure and its unit as two unrelated things. */}
                <p
                  className={styles.total}
                  aria-label={total ? `${total} ${labels.unit}` : undefined}
                >
                  <span className={styles.totalValue} aria-hidden="true">
                    {total ?? '—'}
                  </span>
                  <span className={styles.totalUnit} aria-hidden="true">
                    {labels.unit}
                  </span>
                </p>
                <p className={styles.detail}>{detail}</p>
              </div>

              <dl className={styles.facts}>
                {facts.map((fact, index) => (
                  <div
                    className={styles.fact}
                    key={fact.key}
                    style={{ ['--factRail' as string]: RAILS[index % RAILS.length] }}
                  >
                    <dt className={styles.factKey}>{fact.key}</dt>
                    <dd className={styles.factValue}>{fact.value}</dd>
                    <dd className={styles.factSub}>{fact.sub}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className={styles.compare}>
              <p className={styles.compareHead}>{labels.compare}</p>
              <div className={styles.bars}>
                {byMode.map((entry) => (
                  <button
                    key={entry.mode}
                    type="button"
                    className={styles.bar}
                    aria-pressed={entry.mode === mode}
                    data-worst={
                      entry.mode === worstMode && entry.mode !== mode ? 'true' : undefined
                    }
                    onClick={() => onModeChange(entry.mode)}
                  >
                    <span className={styles.barLabel}>{entry.mode}</span>
                    <span className={styles.barTrack}>
                      {/* Floored at 2%, so a mode that emits almost nothing is
                        still visibly on the chart rather than absent from it. */}
                      <span
                        className={styles.barFill}
                        style={{ width: `${Math.max(2, Math.round(entry.share * 100))}%` }}
                      />
                    </span>
                    <span className={styles.barValue}>{entry.label}</span>
                  </button>
                ))}
              </div>
              <p className={styles.compareNote}>{comparison}</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.foot}>
        <p className={styles.disclaimer}>{labels.disclaimer}</p>
        {action}
      </div>
    </section>
  );
});
