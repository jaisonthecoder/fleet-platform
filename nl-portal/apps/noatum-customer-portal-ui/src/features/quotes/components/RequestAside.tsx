import { useTranslation } from 'react-i18next';

import { RingGauge } from '../../../design-system';

import styles from './RequestAside.module.css';

/* ── completeness ─────────────────────────────────────────────────────────── */

export interface RequestStep {
  id: string;
  label: string;
  done: boolean;
  note: string;
}

export interface RequestProgressProps {
  steps: RequestStep[];
  /**
   * Whether to list the steps under the ring.
   *
   * Off where a stepper already names every section and says where each one
   * stands: the ring answers "how much is left", and the list would be a second
   * copy of the rail that can disagree with it.
   */
  listSteps?: boolean;
}

/**
 * How much of the request is done, and where the rest of it is.
 *
 * Each step links to its own card, which is what makes this more than a status
 * display: a customer who cannot see what is missing scrolls the whole form
 * looking for it.
 *
 * The ring is DA-06, not a second hand-rolled one: it already draws the arc,
 * announces the figure and carries the tone. Green once the request can be
 * sent, the action colour while it cannot — never red, which is for errors.
 */
export function RequestProgress({ steps, listSteps = true }: RequestProgressProps) {
  const { t } = useTranslation();

  const done = steps.filter((step) => step.done).length;
  const ready = done === steps.length;
  const percent = Math.round((done / steps.length) * 100);

  return (
    <div className={styles.progress}>
      <div className={styles.progressHead}>
        <RingGauge
          value={percent}
          label={t('reqCompleteLabel')}
          caption={t('reqCompleteCaption')}
          tone={ready ? 'success' : 'action'}
          formatValueText={(value) => t('reqCompleteAnnounce', { percent: value })}
        />
        <div>
          {/* Announced, because it changes as the customer types and is the
              answer to "can I send this yet". */}
          <p className={styles.progressTitle} aria-live="polite">
            {ready ? t('reqReadyTitle') : t('reqIncompleteTitle', { done })}
          </p>
          <p className={styles.progressNote}>
            {ready ? t('reqReadyNote') : t('reqIncompleteNote')}
          </p>
        </div>
      </div>

      {listSteps && (
        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step.id}>
              <a className={styles.step} href={`#${step.id}`} data-done={step.done ? 'true' : undefined}>
                <span className={styles.stepMark} aria-hidden="true" />
                <span className={styles.stepLabel}>{step.label}</span>
                <span className={styles.stepNote}>{step.note}</span>
                <span className={styles.stepState}>
                  {step.done ? t('reqStepDone') : t('reqStepTodo')}
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── live summary ─────────────────────────────────────────────────────────── */

export interface SummaryRow {
  key: string;
  label: string;
  value: string;
  /** Marks a figure the customer should notice, such as an unanswered hazard. */
  attention?: boolean;
}

export interface RequestSummaryProps {
  rows: SummaryRow[];
  chips: string[];
}

/** What the request currently says, updated as it is typed. */
export function RequestSummary({ rows, chips }: RequestSummaryProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.summary}>
      <div className={styles.summaryHead}>
        <span className={styles.summaryLabel}>{t('reqSummaryTitle')}</span>
        <span className={styles.summaryLive}>{t('reqSummaryLive')}</span>
      </div>

      <dl className={styles.summaryRows}>
        {rows.map((row) => (
          <div key={row.key} className={styles.summaryRow}>
            <dt>{row.label}</dt>
            <dd data-attention={row.attention ? 'true' : undefined}>{row.value}</dd>
          </div>
        ))}
      </dl>

      {chips.length > 0 && (
        <div className={styles.summaryChips}>
          {chips.map((chip) => (
            <span key={chip} className={styles.summaryChip}>{chip}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── journey stages ───────────────────────────────────────────────────────── */

export interface JourneyStage {
  id: string;
  label: string;
  /** Time the cargo is standing still rather than moving. */
  dwell?: boolean;
}

export interface RequestStagesProps {
  stages: readonly JourneyStage[];
}

/**
 * What this shipment passes through, in order.
 *
 * Deliberately carries no durations. We hold no schedule, no carrier feed and
 * no completed shipments to measure, so any number here would be invented —
 * and the product already has a real answer to "how long": a pricing
 * specialist types a transit range onto each option they send back.
 *
 * What we can say honestly is the shape of the journey, because the request
 * itself decides it: the mode chooses the middle, and the scope decides whether
 * there is a collection at one end and a delivery at the other. That is worth
 * showing to somebody who has never shipped port to port before.
 */
export function RequestStages({ stages }: RequestStagesProps) {
  const { t } = useTranslation();
  if (stages.length === 0) return null;

  return (
    <div className={styles.journey}>
      <div className={styles.journeyHead}>
        <span className={styles.journeyLabel}>{t('reqJourneyTitle')}</span>
      </div>

      <div className={styles.journeyBody}>
        <ol className={styles.stages}>
          {stages.map((stage) => (
            <li key={stage.id} className={styles.stage} data-dwell={stage.dwell || undefined}>
              <span className={styles.stageMark} aria-hidden="true" />
              <span className={styles.stageLabel}>
                {stage.label}
                {/* Named in words, never only shaded: dwell is where a lane
                    loses its week and it should not be a colour to decode. */}
                {stage.dwell && <span className={styles.stageDwell}> · {t('reqJourneyDwell')}</span>}
              </span>
            </li>
          ))}
        </ol>

        <p className={styles.journeyNote}>{t('reqJourneyNote')}</p>
      </div>
    </div>
  );
}

