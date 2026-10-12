import {
  DASHBOARD_STAGES,
  type DashboardAgeingBucketDto,
  type DashboardArrivalDto,
  type DashboardEmissionsDto,
  type DashboardInFlightDto,
  type DashboardKpiDto,
  type DashboardLaneDto,
  type DashboardMode,
  type DashboardModeSliceDto,
  type DashboardMonthDto,
  type DashboardOnTimeDto,
  type DashboardPeriod,
  type DashboardSpendDto,
  type DashboardTransitDto,
} from '../../contracts';

/**
 * The sample dashboard.
 *
 * Everything CargoWise owns — shipments, milestones, charges, invoices, transit
 * times — has no table here yet, so a pilot environment has nothing to draw. The
 * options were an empty screen, a screen of zeroes, or a generated one that says
 * it is generated. The third is the only one that lets the shape of the page be
 * reviewed before the integration lands.
 *
 * Two rules this file keeps, both of which matter more than the numbers:
 *
 *  1. DETERMINISTIC. Seeded from the tenant, so a customer sees the same figures
 *     on every refresh and two people looking at one screen see one dashboard.
 *     Random data makes a demo look broken and makes a bug impossible to report.
 *  2. INTERNALLY CONSISTENT. The lanes add up to the mode mix, the mode mix adds
 *     up to the shipment count, the charge split adds up to the spend, and the
 *     ageing buckets add up to the balance. A dashboard whose panels contradict
 *     each other teaches people not to read it.
 *
 * When the shipment tables arrive, this file is deleted and the service reads
 * them. Nothing outside it knows the figures were generated except through
 * `source`, which is exactly the seam that makes the swap a small change.
 */

/** Deterministic PRNG. Small, stable, and not used for anything security-bearing. */
function seeded(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole numbers in a range, inclusive. */
const between = (random: () => number, low: number, high: number) =>
  low + Math.floor(random() * (high - low + 1));

const MONTHS_IN: Record<DashboardPeriod, number> = { '3m': 3, '6m': 6, '12m': 12 };

/**
 * The lanes this sample customer runs.
 *
 * `perYear` is shipments a year on that lane, not a share: the whole dashboard
 * is derived from it, so it is the one number that decides whether the screen
 * describes a mid-sized importer or a multinational. Forty-eight movements a
 * year across seven lanes is the former, which is who this portal is for.
 */
const LANES = [
  { originCode: 'CNTAO', originName: 'Qingdao', destinationCode: 'ESVLC', destinationName: 'Valencia', mode: 'sea_fcl' as const, perYear: 14, quoted: [30, 34] as const, spread: 7, onTime: 89 },
  { originCode: 'CNNGB', originName: 'Ningbo', destinationCode: 'ESBCN', destinationName: 'Barcelona', mode: 'sea_fcl' as const, perYear: 9, quoted: [31, 35] as const, spread: 8, onTime: 86 },
  { originCode: 'CNSHA', originName: 'Shanghai', destinationCode: 'ESVLC', destinationName: 'Valencia', mode: 'sea_fcl' as const, perYear: 7, quoted: [32, 36] as const, spread: 5, onTime: 93 },
  { originCode: 'CNPVG', originName: 'Shanghai Pudong', destinationCode: 'ESMAD', destinationName: 'Madrid', mode: 'air' as const, perYear: 6, quoted: [3, 5] as const, spread: 2, onTime: 97 },
  { originCode: 'VNSGN', originName: 'Ho Chi Minh City', destinationCode: 'ESVLC', destinationName: 'Valencia', mode: 'sea_lcl' as const, perYear: 6, quoted: [36, 40] as const, spread: 9, onTime: 83 },
  { originCode: 'INNSA', originName: 'Nhava Sheva', destinationCode: 'ESVLC', destinationName: 'Valencia', mode: 'sea_fcl' as const, perYear: 3, quoted: [24, 28] as const, spread: 9, onTime: 67 },
  { originCode: 'TRIST', originName: 'Istanbul', destinationCode: 'ESVLC', destinationName: 'Valencia', mode: 'sea_lcl' as const, perYear: 3, quoted: [8, 10] as const, spread: 3, onTime: 100 },
];

/** Per-shipment spend by mode, in minor units. Air is dearer and lighter. */
const UNIT_SPEND: Record<'sea_fcl' | 'sea_lcl' | 'air', number> = {
  sea_fcl: 843_000,
  sea_lcl: 250_000,
  air: 1_533_000,
};

/** Kilograms of CO2e per shipment, by mode. Air is the point of the panel. */
const UNIT_CO2: Record<'sea_fcl' | 'sea_lcl' | 'air', number> = {
  sea_fcl: 3_100,
  sea_lcl: 500,
  air: 7_100,
};

export interface SampleInput {
  seed: string;
  period: DashboardPeriod;
  mode: DashboardMode;
  currency: string;
  /** Real figures the platform does hold, folded in rather than invented. */
  real: { openQuotes: number; quotesAwaitingDecision: number };
}

export interface SampleDashboard {
  monthly: DashboardMonthDto[];
  modeMix: DashboardModeSliceDto[];
  lanes: DashboardLaneDto[];
  transit: DashboardTransitDto[];
  onTime: DashboardOnTimeDto;
  inFlight: DashboardInFlightDto;
  spend: DashboardSpendDto;
  invoices: ReturnType<typeof invoicesOf>;
  emissions: DashboardEmissionsDto;
  kpis: DashboardKpiDto[];
  shipments: number;
}

/** The first day of each month in the window, oldest first. */
function monthsOf(period: DashboardPeriod, today: Date): string[] {
  const count = MONTHS_IN[period];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (count - 1 - index), 1));
    return date.toISOString().slice(0, 10);
  });
}

function invoicesOf(random: () => number, spendMinorUnits: number) {
  // A quarter of the year's spend is still open, spread over the ageing buckets
  // the way a customer paying to terms actually looks: most of it current.
  const open = Math.round(spendMinorUnits * 0.175);
  const shares = [0.635, 0.271, 0.094, 0, 0];
  const ageing: DashboardAgeingBucketDto[] = ['current', '1_30', '31_60', '61_90', '90_plus'].map(
    (bucket, index) => ({ bucket, amountMinorUnits: Math.round(open * (shares[index] ?? 0)) }),
  );
  const overdue = ageing
    .filter((entry) => entry.bucket !== 'current')
    .reduce((sum, entry) => sum + entry.amountMinorUnits, 0);

  return {
    openMinorUnits: ageing.reduce((sum, entry) => sum + entry.amountMinorUnits, 0),
    termsDays: 30,
    ageing,
    creditUsedMinorUnits: open,
    creditLimitMinorUnits: Math.round(open / 0.45 / 1_000_000) * 1_000_000 + between(random, 0, 0),
    overdueMinorUnits: overdue,
  };
}

export function sampleDashboard(input: SampleInput): SampleDashboard {
  const random = seeded(`${input.seed}:${input.period}:${input.mode}`);
  const today = new Date();
  const months = monthsOf(input.period, today);

  const modes = (['sea_fcl', 'sea_lcl', 'air'] as const).filter(
    (mode) => input.mode === 'all' || input.mode === mode,
  );

  /*
   * Shipments per lane per month. Everything else on the screen is derived from
   * this one table, which is what keeps the panels agreeing with each other.
   */
  const served = LANES.filter((lane) => modes.includes(lane.mode));

  /*
   * Shipments dealt into months rather than averaged across them.
   *
   * A lane running nine a year is not "one a month, rounded up" - that is how a
   * seven-lane customer ended up with a hundred and forty movements. Each
   * shipment picks a month, so the annual total is exactly right and the
   * monthly shape is lumpy in the way real bookings are.
   */
  const perLaneMonth = served.map((lane) => {
    const counts = months.map(() => 0);
    const total = Math.max(1, Math.round((lane.perYear * months.length) / 12));
    for (let index = 0; index < total; index += 1) {
      const month = between(random, 0, months.length - 1);
      counts[month] = (counts[month] ?? 0) + 1;
    }
    return counts;
  });

  const monthly: DashboardMonthDto[] = months.map((month, index) => {
    const counts = { sea_fcl: 0, sea_lcl: 0, air: 0 };
    let spend = 0;
    served.forEach((lane, laneIndex) => {
      const shipments = perLaneMonth[laneIndex]?.[index] ?? 0;
      counts[lane.mode] += shipments;
      spend += shipments * UNIT_SPEND[lane.mode];
    });
    return { month, seaFcl: counts.sea_fcl, seaLcl: counts.sea_lcl, air: counts.air, spendMinorUnits: spend };
  });

  const shipments = monthly.reduce((sum, entry) => sum + entry.seaFcl + entry.seaLcl + entry.air, 0);
  const totalSpend = monthly.reduce((sum, entry) => sum + entry.spendMinorUnits, 0);

  const modeMix: DashboardModeSliceDto[] = modes.map((mode) => {
    const count = monthly.reduce(
      (sum, entry) => sum + (mode === 'sea_fcl' ? entry.seaFcl : mode === 'sea_lcl' ? entry.seaLcl : entry.air),
      0,
    );
    return { mode, shipments: count, spendMinorUnits: count * UNIT_SPEND[mode] };
  });

  const lanes: DashboardLaneDto[] = served
    .map((lane, laneIndex) => {
      const byMonth = perLaneMonth[laneIndex] ?? [];
      const count = byMonth.reduce((sum, value) => sum + value, 0);
      const spend = count * UNIT_SPEND[lane.mode];
      // Sits inside the quoted window on a good lane and drifts past it on a bad
      // one, so the transit chart and the on-time column tell the same story.
      const midpoint = (lane.quoted[0] + lane.quoted[1]) / 2;
      const average = Number((midpoint + (1 - lane.onTime / 100) * lane.spread).toFixed(1));
      return {
        originCode: lane.originCode,
        originName: lane.originName,
        destinationCode: lane.destinationCode,
        destinationName: lane.destinationName,
        mode: lane.mode,
        shipments: count,
        averageTransitDays: average,
        quotedMinDays: lane.quoted[0],
        quotedMaxDays: lane.quoted[1],
        onTimePercent: lane.onTime,
        spendMinorUnits: spend,
        trend: byMonth.map((value) => value * UNIT_SPEND[lane.mode]),
        sharePercent: totalSpend === 0 ? 0 : Math.round((spend / totalSpend) * 100),
      };
    })
    .sort((a, b) => b.spendMinorUnits - a.spendMinorUnits);

  const spreadOf = (code: string, destination: string) =>
    LANES.find((entry) => entry.originCode === code && entry.destinationCode === destination)?.spread ?? 6;

  const transit: DashboardTransitDto[] = lanes.slice(0, 6).map((lane) => {
    const spread = spreadOf(lane.originCode, lane.destinationCode);
    return {
      lane: `${lane.originCode} to ${lane.destinationCode}`,
      quotedMinDays: lane.quotedMinDays,
      quotedMaxDays: lane.quotedMaxDays,
      actualMinDays: Number((lane.averageTransitDays - spread / 2).toFixed(1)),
      actualMaxDays: Number((lane.averageTransitDays + spread / 2).toFixed(1)),
      averageDays: lane.averageTransitDays,
    };
  });

  /*
   * The headline is the lanes, weighted by volume - not a separate number.
   *
   * Drawn independently they disagreed: the tile said 89% while every row under
   * it was red. A customer who spots that stops trusting both figures, and they
   * would be right to. The monthly points then scatter around the same average,
   * so the chart, the tile and the table are one claim made three ways.
   */
  const shipped = lanes.reduce((sum, lane) => sum + lane.shipments, 0);
  const onTimeAverage =
    shipped === 0
      ? 0
      : Math.round(
          lanes.reduce((sum, lane) => sum + lane.onTimePercent * lane.shipments, 0) / shipped,
        );

  const onTimePoints = months.map((month) => ({
    month,
    percent: Math.max(60, Math.min(100, onTimeAverage + between(random, -7, 7))),
  }));

  const onTime: DashboardOnTimeDto = {
    percent: onTimeAverage,
    targetPercent: 90,
    monthsOnTarget: onTimePoints.filter((point) => point.percent >= 90).length,
    points: onTimePoints,
  };

  /* What is moving now: a tenth of the year's volume, spread across the stages. */
  const live = Math.max(4, Math.round(shipments / 4.4));
  const weights = [0.27, 0.18, 0.37, 0.09, 0.09];
  const stages = DASHBOARD_STAGES.map((key, index) => ({
    key,
    count: Math.max(0, Math.round(live * (weights[index] ?? 0))),
  }));

  const arriving: DashboardArrivalDto[] = ([
    {
      date: isoIn(today, 2),
      reference: 'TGHU 4410823',
      lane: 'CNTAO to ESVLC · 40 HC',
      note: 'Discharged at Valencia, free time ends in four days',
      status: 'At terminal',
      tone: 'warning',
    },
    {
      date: isoIn(today, 5),
      reference: 'S00482913',
      lane: 'CNNGB to ESBCN · 2 x 40 HC',
      note: 'Arrived, entry blocked on a missing commercial invoice',
      status: 'Customs hold',
      tone: 'action',
    },
    {
      date: isoIn(today, 7),
      reference: 'AWB 057-4471 2290',
      lane: 'CNPVG to ESMAD · 412 kg',
      note: 'Departed Pudong, routed via Doha',
      status: 'On time',
      tone: 'good',
    },
    {
      date: isoIn(today, 9),
      reference: 'MSCU 5518320',
      lane: 'CNSHA to ESVLC · 40 HC',
      note: 'MSC Jade, passed Suez',
      status: 'On time',
      tone: 'good',
    },
  ] satisfies DashboardArrivalDto[]).filter(
    // An air movement has no business on a sea-only view of the dashboard.
    (entry) => !entry.lane.includes('kg') || modes.includes('air'),
  );

  const inFlight: DashboardInFlightDto = {
    stages,
    arrivingNext: arriving,
    deliveredRecently: between(random, 4, 9),
  };

  /*
   * The charge split. Freight is most of it; demurrage is last and drawn in the
   * action colour because, unlike the others, it is the one line a customer can
   * usually remove by booking delivery inside free time.
   */
  const split = [
    { key: 'freight', label: 'Ocean and air freight', share: 0.61, tone: 'primary' as const },
    { key: 'origin', label: 'Origin charges', share: 0.09, tone: 'info' as const },
    { key: 'destination', label: 'Destination handling', share: 0.11, tone: 'info' as const },
    { key: 'delivery', label: 'Final delivery', share: 0.1, tone: 'neutral' as const },
    { key: 'customs', label: 'Customs clearance', share: 0.06, tone: 'neutral' as const },
    { key: 'demurrage', label: 'Demurrage and detention', share: 0.03, tone: 'action' as const },
  ];
  const slices = split.map((entry) => ({
    key: entry.key,
    label: entry.label,
    amountMinorUnits: Math.round(totalSpend * entry.share),
    percent: Math.round(entry.share * 100),
    tone: entry.tone,
  }));
  const demurrage = slices.find((slice) => slice.key === 'demurrage')?.amountMinorUnits ?? 0;

  const spend: DashboardSpendDto = {
    totalMinorUnits: totalSpend,
    slices,
    note:
      demurrage > 0
        ? 'Most demurrage and detention is avoidable: it accrues when delivery is booked after free time has started running.'
        : null,
  };

  const emissionsMonthly = monthly.map((entry) => ({
    month: entry.month,
    tonnes: Number(
      (
        (entry.seaFcl * UNIT_CO2.sea_fcl + entry.seaLcl * UNIT_CO2.sea_lcl + entry.air * UNIT_CO2.air) /
        1000
      ).toFixed(1),
    ),
  }));
  const totalTonnes = Number(emissionsMonthly.reduce((sum, entry) => sum + entry.tonnes, 0).toFixed(1));
  const byMode = modeMix.map((slice) => ({
    mode: slice.mode,
    percent:
      totalTonnes === 0
        ? 0
        : Math.round(((slice.shipments * UNIT_CO2[slice.mode]) / 1000 / totalTonnes) * 100),
  }));
  const airShareOfMoves =
    shipments === 0
      ? 0
      : Math.round(((modeMix.find((slice) => slice.mode === 'air')?.shipments ?? 0) / shipments) * 100);
  const airShareOfCarbon = byMode.find((slice) => slice.mode === 'air')?.percent ?? 0;

  const emissions: DashboardEmissionsDto = {
    totalTonnes,
    basis: 'Well to wheel, GLEC-aligned estimate',
    monthly: emissionsMonthly,
    byMode,
    note:
      airShareOfCarbon > airShareOfMoves
        ? `Air is ${airShareOfMoves}% of shipments and ${airShareOfCarbon}% of emissions.`
        : null,
  };

  const invoices = invoicesOf(random, totalSpend);

  const doorToDoor = Number(
    (
      lanes.reduce((sum, lane) => sum + lane.averageTransitDays * lane.shipments, 0) /
      Math.max(1, lanes.reduce((sum, lane) => sum + lane.shipments, 0))
    ).toFixed(1),
  );

  const kpis: DashboardKpiDto[] = [
    {
      key: 'shipments',
      value: String(shipments),
      unit: null,
      delta: `${between(random, 4, 22)}%`,
      deltaDirection: 'up',
      deltaTone: 'neutral',
      caption: `vs prior ${MONTHS_IN[input.period]} months`,
      spark: monthly.map((entry) => entry.seaFcl + entry.seaLcl + entry.air),
    },
    {
      key: 'on_time',
      value: `${onTime.percent}%`,
      unit: null,
      delta: `${(random() * 5).toFixed(1)} pts`,
      deltaDirection: onTime.percent >= onTime.targetPercent ? 'up' : 'down',
      deltaTone: onTime.percent >= onTime.targetPercent ? 'good' : 'bad',
      caption: `target ${onTime.targetPercent}%`,
      spark: onTimePoints.map((point) => point.percent),
    },
    {
      key: 'door_to_door',
      value: String(doorToDoor),
      unit: 'days',
      delta: `${(random() * 6).toFixed(0)}%`,
      deltaDirection: 'down',
      deltaTone: 'good',
      caption: `vs prior ${MONTHS_IN[input.period]} months`,
      spark: monthly.map(() => between(random, 26, 34)),
    },
    {
      key: 'spend',
      value: money(totalSpend, input.currency),
      unit: null,
      delta: `${between(random, 6, 18)}%`,
      deltaDirection: 'up',
      deltaTone: 'neutral',
      caption: `vs prior ${MONTHS_IN[input.period]} months`,
      spark: monthly.map((entry) => entry.spendMinorUnits),
    },
    {
      key: 'balance',
      value: money(invoices.openMinorUnits, input.currency),
      unit: null,
      delta: invoices.overdueMinorUnits > 0 ? money(invoices.overdueMinorUnits, input.currency) : null,
      deltaDirection: invoices.overdueMinorUnits > 0 ? 'flat' : 'none',
      deltaTone: invoices.overdueMinorUnits > 0 ? 'bad' : 'neutral',
      caption: 'over 30 days',
      spark: monthly.map((entry) => Math.round(entry.spendMinorUnits * 0.175)),
    },
  ];

  return { monthly, modeMix, lanes, transit, onTime, inFlight, spend, invoices, emissions, kpis, shipments };
}

/** "EUR 384k" — the tile's own rounding, so the screen never invents one. */
function money(minorUnits: number, currency: string): string {
  const major = minorUnits / 100;
  if (major >= 1_000_000) return `${currency} ${(major / 1_000_000).toFixed(1)}M`;
  if (major >= 10_000) return `${currency} ${Math.round(major / 1000)}k`;
  if (major >= 1000) return `${currency} ${(major / 1000).toFixed(1)}k`;
  return `${currency} ${major.toFixed(0)}`;
}

function isoIn(from: Date, days: number): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
