import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Co2Calculator as Co2CalculatorPanel,
  type Co2Fact,
  type Co2Mode,
  type Co2ModeResult,
} from '../../design-system';
import type { FreightMode } from '../../api/public/contracts';
import { useCo2Estimate, useEmissionsReference } from '../api/emissions';
import { useDebounced } from '../../lib/use-debounced';
import styles from './Co2Calculator.module.css';

export type { FreightMode };

/**
 * The CO2e calculator, wired to the emissions endpoints.
 *
 * The panel itself is SP-09 in the design system and knows nothing about the
 * API — this is the half that fetches. Splitting them is what lets the panel
 * appear in the kit gallery, be reused beside a quotation or a shipment, and be
 * tested without a server.
 *
 * The arithmetic is deliberately NOT here. A figure the customer sees must have
 * exactly one implementation and it is the server's: a copy in the browser is
 * how the number on the screen ends up disagreeing with the number on the
 * quotation.
 */
export function Co2Calculator({
  defaultLaneId,
  defaultMode = 'Sea FCL',
  defaultTonnes = 34,
  onSearchRates,
  density,
  className,
  id,
}: {
  /** Lane to open on, by id. Defaults to the first the API offers. */
  defaultLaneId?: string;
  defaultMode?: FreightMode;
  defaultTonnes?: number;
  /** The call to action under the panel. Omit it and the button is not shown. */
  onSearchRates?: (lane: string, mode: FreightMode) => void;
  /** Passed straight through: `compact` suits a sidebar. */
  density?: 'default' | 'compact';
  className?: string;
  /** So a page can link or scroll to the calculator as a block. */
  id?: string;
}) {
  const { t } = useTranslation();
  const reference = useEmissionsReference();
  const [chosenLaneId, setChosenLaneId] = useState<string | null>(null);
  const [requestedMode, setRequestedMode] = useState<FreightMode>(defaultMode);
  const [tonnesInput, setTonnesInput] = useState(String(defaultTonnes));

  const lanes = reference.data?.lanes ?? [];
  const lane = lanes.find((entry) => entry.id === (chosenLaneId ?? defaultLaneId)) ?? lanes[0];
  // Changing lane can strip the chosen mode. Fall back rather than show zero.
  const mode = lane && lane.modes.includes(requestedMode) ? requestedMode : lane?.modes[0];

  /*
   * The catalogue is lane-shaped; the panel asks for two ends.
   *
   * Splitting the label on the arrow is a stopgap and knows it: the real fix is
   * an estimate endpoint that takes an origin and a destination code, which is
   * exactly the shape `EmissionsAdapter` already declares. Until that exists,
   * this keeps the control honest without inventing lanes that are not served.
   */
  const ends = (label: string): [string, string] => {
    const [from, to] = label.split('→').map((part) => part.trim());
    return [from ?? label, to ?? ''];
  };
  const unique = (values: string[]) => [...new Set(values)];

  const origins = unique(lanes.map((entry) => ends(entry.label)[0]));
  const currentOrigin = lane ? ends(lane.label)[0] : (origins[0] ?? '');
  // Only the destinations this origin actually reaches: offering a pair with no
  // lane behind it would produce a dead estimate the customer cannot explain.
  const destinations = unique(
    lanes.filter((entry) => ends(entry.label)[0] === currentOrigin).map((entry) => ends(entry.label)[1]),
  );
  const currentDestination = lane ? ends(lane.label)[1] : (destinations[0] ?? '');

  const laneFor = (from: string, to: string) =>
    lanes.find((entry) => {
      const [f, t] = ends(entry.label);
      return f === from && t === to;
    });

  const pickOrigin = (from: string) => {
    // Keep the destination when the new origin still reaches it; otherwise take
    // the first one it does, so the panel is never on a pair with no data.
    const next = laneFor(from, currentDestination)
      ?? lanes.find((entry) => ends(entry.label)[0] === from);
    if (next) setChosenLaneId(next.id);
  };

  const pickDestination = (to: string) => {
    const next = laneFor(currentOrigin, to);
    if (next) setChosenLaneId(next.id);
  };

  // Typing a weight must not fire a request per keystroke, and the answers
  // would race each other back if it did.
  const settledTonnes = useDebounced(tonnesInput, 250);
  const tonnes = Math.max(0.1, Number(settledTonnes) || 0.1);

  const estimate = useCo2Estimate(lane && mode ? { laneId: lane.id, mode, tonnes } : null);
  const result = estimate.data;

  if (reference.isPending) {
    return (
      <section id={id} className={[styles.state, className ?? ''].filter(Boolean).join(' ')} role="status">
        <p>{t('co2Loading')}</p>
      </section>
    );
  }

  /*
   * No catalogue, no panel.
   *
   * The emissions endpoints are not implemented server-side, so this is the
   * state a real environment is in today. Saying so beats drawing an empty
   * calculator that looks broken, and beats inventing factors in the browser.
   */
  if (reference.isError || !lane || !mode) {
    return (
      <section id={id} className={[styles.state, className ?? ''].filter(Boolean).join(' ')} role="alert">
        <p>{t('co2Unavailable')}</p>
        <button type="button" className={styles.retry} onClick={() => void reference.refetch()}>
          {t('retry')}
        </button>
      </section>
    );
  }

  const round = (value: number) => Math.round(value).toLocaleString('en-US');
  const kgFor = (candidate: FreightMode) =>
    result?.byMode.find((entry) => entry.mode === candidate)?.kg ?? 0;
  const peak = Math.max(1, ...(result?.byMode.map((entry) => entry.kg) ?? [1]));

  const comparison = !result
    ? ''
    : result.byMode.length <= 1
      ? t('co2OneModeOnly')
      : result.mode === result.lowestMode
        ? t('co2IsLowest', {
            mode: result.highestMode,
            ratio: (kgFor(result.highestMode) / Math.max(1, kgFor(result.lowestMode))).toFixed(1),
          })
        : t('co2CouldSave', {
            mode: result.lowestMode,
            saving: round(result.kg - kgFor(result.lowestMode)),
          });

  const facts: Co2Fact[] = [
    { key: t('co2Distance'), value: result ? `${round(result.distanceKm)} km` : '—', sub: t('co2DistanceNote') },
    { key: t('co2Intensity'), value: result ? `${result.intensity} g` : '—', sub: t('co2IntensityNote') },
    { key: t('co2PerTonne'), value: result ? `${round(result.perTonneKg)} kg` : '—', sub: t('co2PerTonneNote') },
  ];

  const byMode: Co2ModeResult[] = (result?.byMode ?? lane.modes.map((m) => ({ mode: m, kg: 0 }))).map(
    (entry) => ({
      mode: entry.mode as Co2Mode,
      label: result ? `${round(entry.kg)} kg` : '—',
      share: result ? entry.kg / peak : 0,
    }),
  );

  return (
    <Co2CalculatorPanel
      id={id}
      className={className}
      density={density}
      labels={{
        title: t('co2Title'),
        blurb: t('co2Blurb'),
        origin: t('co2Origin'),
        destination: t('co2Destination'),
        mode: t('co2Mode'),
        weight: t('co2Weight'),
        tonnes: t('co2Tonnes'),
        basis: `${reference.data.basis} · ${t('co2Basis')}`,
        estimated: t('co2Estimated', { mode }),
        unit: t('co2Unit'),
        compare: t('co2Compare'),
        disclaimer: t('co2Disclaimer'),
        unservedMode: (unserved) => t('co2ModeUnserved', { mode: unserved }),
      }}
      origins={origins.map((label) => ({ id: label, label }))}
      originId={currentOrigin}
      onOriginChange={pickOrigin}
      destinations={destinations.map((label) => ({ id: label, label }))}
      destinationId={currentDestination}
      onDestinationChange={pickDestination}
      modes={reference.data.modes as Co2Mode[]}
      servedModes={lane.modes as Co2Mode[]}
      mode={mode as Co2Mode}
      onModeChange={(next) => setRequestedMode(next as FreightMode)}
      tonnes={tonnesInput}
      onTonnesChange={setTonnesInput}
      presets={reference.data.presets.map((preset) => ({
        id: preset.id,
        tonnes: preset.tonnes,
        label: t(`co2Preset_${preset.id}`, { tonnes: preset.tonnes }),
      }))}
      total={result ? round(result.kg) : null}
      detail={
        result
          ? `${result.tonnes.toLocaleString('en-US')} t · ${round(result.distanceKm)} km · ${lane.label}`
          : lane.label
      }
      facts={facts}
      byMode={byMode}
      worstMode={result?.highestMode as Co2Mode | undefined}
      comparison={comparison}
      busy={estimate.isFetching}
      action={
        onSearchRates && (
          <button
            type="button"
            className={styles.cta}
            onClick={() => onSearchRates(lane.label, mode)}
          >
            {t('co2SearchRates')}
          </button>
        )
      }
    />
  );
}
