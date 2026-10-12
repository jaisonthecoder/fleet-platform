import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardRail, ContainerSelector, FilterPills } from '../../../design-system';
import { REFERENCE, useReference } from '../../../shared/reference/useReference';

import styles from './EquipmentPicker.module.css';

/** One container type on the form, before it becomes an API entry. */
export interface EquipmentDraft {
  /** Stable id, shared with cargo lines so a hazard can name this container. */
  unitId: string;
  containerType: string;
  quantity: number;
  grossWeightPerUnitKg: string;
}

/** Indicative figures the lookup carries. Presentation only; no rule reads them. */
interface ContainerFigures {
  group?: string;
  teu?: number;
  maxPayloadKg?: number;
  capacityM3?: number;
  lengthM?: number;
  widthM?: number;
  heightM?: number;
}

export interface EquipmentPickerProps {
  entries: EquipmentDraft[];
  onChange: (entries: EquipmentDraft[]) => void;
  /**
   * Container type to scroll the rail to, chosen somewhere other than the rail.
   * `at` changes on every request so asking twice for the same card still moves.
   */
  focus?: { code: string; at: number } | null;
}

const figuresOf = (metadata: unknown): ContainerFigures => (metadata ?? {}) as ContainerFigures;

const number = (value: string): number | null => {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Chooses containers for a full-load request.
 *
 * A full-container request is not a list of packages. Asking the customer to
 * describe two 40ft high cubes as package lines makes them describe something
 * they did not mean, and leaves the pricer multiplying a per-container charge by
 * a number that is not there.
 *
 * The payload figure warns and never refuses. The binding limit is on the
 * individual container's CSC plate and a road or rail leg often binds lower, so
 * a hard rule here would block requests that are perfectly shippable.
 */
export function EquipmentPicker({ entries, onChange, focus }: EquipmentPickerProps) {
  const { t } = useTranslation();
  const [group, setGroup] = useState('all');

  const types = useReference(REFERENCE.containerType, { audience: 'customer' });
  const items = useMemo(() => types.data ?? [], [types.data]);

  const groups = useMemo(() => {
    const seen = items.map((item) => figuresOf(item.metadata).group).filter(Boolean) as string[];
    return ['all', ...Array.from(new Set(seen))];
  }, [items]);

  const shown = items.filter(
    (item) => group === 'all' || figuresOf(item.metadata).group === group,
  );

  // Only a card the current filter is actually showing can be scrolled to.
  const focusIndex = focus ? shown.findIndex((item) => item.code === focus.code) : -1;

  const countOf = (code: string) =>
    entries.find((entry) => entry.containerType === code)?.quantity ?? 0;

  const setCount = (code: string, quantity: number) => {
    if (quantity <= 0) {
      onChange(entries.filter((entry) => entry.containerType !== code));
      return;
    }

    const existing = entries.find((entry) => entry.containerType === code);
    if (existing) {
      onChange(entries.map((e) => (e.containerType === code ? { ...e, quantity } : e)));
      return;
    }

    onChange([
      ...entries,
      { unitId: crypto.randomUUID(), containerType: code, quantity, grossWeightPerUnitKg: '' },
    ]);
  };

  const setWeight = (code: string, value: string) =>
    onChange(
      entries.map((e) => (e.containerType === code ? { ...e, grossWeightPerUnitKg: value } : e)),
    );

  return (
    <div className={styles.picker}>
      {groups.length > 1 && (
        <FilterPills
          label={t('eqGroupFilter')}
          options={groups.map((value) => ({
            value,
            label: t(`eqGroup_${value}`, { defaultValue: value }),
          }))}
          value={group}
          onValueChange={setGroup}
        />
      )}

      {types.isPending && <p className={styles.note}>{t('loading')}</p>}
      {!types.isPending && shown.length === 0 && <p className={styles.note}>{t('eqNoTypes')}</p>}

      {/*
        Twelve container types laid out as a wrapping grid is four rows of tall
        cards in the middle of the form. Past three they go on one rail, so the
        choice stays one question and the rest of the form stays on screen.
      */}
      <CardRail
        label={t('eqTitle')}
        previousLabel={t('eqRailPrevious')}
        nextLabel={t('eqRailNext')}
        focusIndex={focusIndex >= 0 ? focusIndex : null}
        focusNonce={focus?.at}
        positionLabel={({ first, last, total }) =>
          t('eqRailPosition', { first, last, total })
        }
      >
        {shown.map((item) => {
          const figures = figuresOf(item.metadata);
          const count = countOf(item.code);
          const entry = entries.find((e) => e.containerType === item.code);
          const weight = number(entry?.grossWeightPerUnitKg ?? '') ?? 0;
          // The lookup carries no payload for some types. Without a limit there is
          // nothing to measure against, so the meter is given a nominal one and the
          // note says the figure is unknown rather than drawing a false 0%.
          const limit = figures.maxPayloadKg ?? 0;

          return (
            <ContainerSelector
              key={item.code}
              label={item.label}
              code={item.code}
              dimensions={
                figures.lengthM === undefined
                  ? item.label
                  : `${figures.lengthM} × ${figures.widthM}${
                      figures.heightM === undefined ? '' : ` × ${figures.heightM}`
                    } m`
              }
              capacity={
                figures.capacityM3 === undefined
                  ? undefined
                  : t('eqCapacityValue', { m3: figures.capacityM3 })
              }
              count={count}
              onCountChange={(next) => setCount(item.code, next)}
              countLabel={t('eqTitle')}
              decrementLabel={t('eqRemoveOne', { type: item.label })}
              incrementLabel={t('eqAddOne', { type: item.label })}
              payload={weight}
              payloadLimit={limit || 1}
              onPayloadChange={(next) => setWeight(item.code, String(next))}
              payloadLabel={t('eqGrossPerUnit')}
              payloadUnit={t('eqUnitKg')}
              payloadNote={
                limit === 0
                  ? t('eqPayloadUnknown')
                  : t('eqPayloadOf', {
                      percent: Math.round((weight / limit) * 100),
                      limit: limit.toLocaleString(),
                    })
              }
              payloadValueText={t('eqPayloadAnnounce', {
                kg: weight.toLocaleString(),
                limit: limit.toLocaleString(),
              })}
              // Warns, never refuses: the binding figure is on the individual
              // container's CSC plate and an inland leg often binds lower.
              overLabel={t('eqOverPayload')}
            />
          );
        })}
      </CardRail>
    </div>
  );
}

/** Total gross across every container, for the request's headline weight. */
export function equipmentGrossWeight(entries: EquipmentDraft[]): number {
  return entries.reduce(
    (sum, entry) => sum + entry.quantity * (number(entry.grossWeightPerUnitKg) ?? 0),
    0,
  );
}

/** The API shape. Weight is optional: a customer may not know it yet. */
export function toEquipmentInput(entry: EquipmentDraft) {
  return {
    unitId: entry.unitId,
    containerType: entry.containerType,
    quantity: entry.quantity,
    grossWeightPerUnitKg: number(entry.grossWeightPerUnitKg) ?? undefined,
  };
}
