import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ChargeBreakdown } from '../components/ChargeBreakdown';
import { ChipToggles, FilterPills } from '../components/ChipToggles';
import { IncotermStrip } from '../components/IncotermStrip';
import { ColdStart } from '../components/ColdStart';
import { ContainerFill } from '../components/ContainerFill';
import { ContainerSelector } from '../components/ContainerSelector';
import { ContainerUtilisation } from '../components/ContainerUtilisation';
import { FreeTimeMeter } from '../components/FreeTimeMeter';
import { LegBreakdown } from '../components/LegBreakdown';
import { InlineTextWait } from '../components/InlineTextWait';
import { LoadingThread } from '../components/LoadingThread';
import { RefreshOverlay } from '../components/RefreshOverlay';
import { SkeletonRows } from '../components/SkeletonRows';
import { RouteLoader } from '../components/RouteLoader';
import { Spinner } from '../components/Spinner';
import { CardRail } from '../components/CardRail';
import { Co2Calculator, type Co2Mode } from '../components/Co2Calculator';
import { ComboInput } from '../components/ComboInput';
import { Pagination } from '../components/DataTable';
import { ListingHero } from '../components/ListingHero';
import { HeroBand, HeroChip } from '../components/HeroBand';
import { RouteBreadcrumb } from '../components/RouteBreadcrumb';
import { DateDisplay, type DateParts } from '../components/DateDisplay';
import { DateField } from '../components/DateField';
import { DatePicker } from '../components/DatePicker';
import { DayPicker } from '../components/DayPicker';
import { SchedulePicker } from '../components/SchedulePicker';
import { ModeCards } from '../components/ModeCards';
import { PartyCard } from '../components/PartyCard';
import { SelectedStrip } from '../components/SelectedStrip';
import { Select } from '../components/Select';
import { RouteProgress } from '../components/RouteProgress';
import { StatTile } from '../components/StatTile';
import { ModeLadder } from '../components/ModeLadder';
import { RadioCards } from '../components/RadioCards';
import { RingGauge } from '../components/RingGauge';
import { SparklineTrend } from '../components/SparklineTrend';
import styles from './Gallery.module.css';

/**
 * The design system's own gallery: one page that demonstrates the UI kit.
 *
 * Self-contained on purpose. Everything it needs — catalogue, specimens and
 * the token check — lives in this file, so the design system can be lifted out
 * or deleted without leaving anything dangling anywhere else in the app. The
 * only reference from outside is the route in app/router.tsx.
 *
 * Dev-only, and deliberately outside the portal shell: it demonstrates the kit,
 * so it must not inherit application chrome.
 *
 * Design source of truth:
 * REFERENCE/MOCKUP - Fright Forwarder Customer Portal/Noatum UI Kit.dc.html
 */

/* ------------------------------------------------------------------------ */
/* Token check                                                              */
/* ------------------------------------------------------------------------ */

interface TokenSpec {
  name: string;
  token: string;
  /** What the mockup specifies. */
  expected: string;
}

interface TokenCheck extends TokenSpec {
  actual: string;
  matches: boolean;
}

/** `1.875rem` -> `30px`; anything else is returned untouched. */
function remToPx(value: string): string {
  const [, amount] = /^(-?[\d.]+)rem$/.exec(value.trim()) ?? [];
  return amount === undefined ? value.trim() : `${Number(amount) * 16}px`;
}

/** `rgb(170, 39, 47)` -> `#aa272f`. Returns '' for anything else. */
function rgbToHex(value: string): string {
  const [, r, g, b] = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value) ?? [];
  if (!r || !g || !b) return '';
  const channel = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Lower-cases, expands short hex and converts rem, so equal values compare equal. */
function normalise(value: string): string {
  const trimmed = remToPx(value).toLowerCase().replace(/\s+/g, ' ');
  const [, r, g, b] = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(trimmed) ?? [];
  return r && g && b ? `#${r}${r}${g}${g}${b}${b}` : trimmed;
}

/**
 * Resolves a token against the document root. Custom properties come back as
 * authored, so a token pointing at another token is flattened by asking the
 * browser to compute it on a throwaway element.
 */
function readToken(token: string): string {
  if (typeof document === 'undefined') return '';
  const root = document.documentElement;
  const authored = getComputedStyle(root).getPropertyValue(token).trim();
  if (!authored.startsWith('var(')) return authored;

  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;color:${authored}`;
  root.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return rgbToHex(resolved) || authored;
}

function checkTokens(specs: readonly TokenSpec[]): TokenCheck[] {
  return specs.map((spec) => {
    const actual = readToken(spec.token);
    return { ...spec, actual, matches: normalise(actual) === normalise(spec.expected) };
  });
}

/* ------------------------------------------------------------------------ */
/* Catalogue — the mockup's own codes, labels and groups                    */
/* ------------------------------------------------------------------------ */

const GROUPS = [
  'Foundations',
  'Chrome',
  'Actions',
  'Form controls',
  'Selection',
  'Data display',
  'Feedback',
  'Specialised',
  'Loading',
  'Messages',
  'Dates',
  'Forms',
  'Shells',
] as const;

type Group = (typeof GROUPS)[number];

/** `[code, label, group]`, in the mockup's order. */
const CATALOGUE: readonly (readonly [string, string, Group])[] = [
  ['FN-01', 'Brand and state colours', 'Foundations'],
  ['FN-02', 'Type scale', 'Foundations'],
  ['FN-03', 'Surfaces and elevation', 'Foundations'],
  ['FN-04', 'Section header', 'Foundations'],
  ['FN-05', 'Iconography', 'Foundations'],
  ['FN-06', 'Geometry', 'Foundations'],
  ['FN-07', 'Logistics icon set', 'Foundations'],
  ['CH-01', 'Utility bar', 'Chrome'],
  ['CH-02', 'App header', 'Chrome'],
  ['CH-03', 'Side rail', 'Chrome'],
  ['CH-04', 'Breadcrumb · route line', 'Chrome'],
  ['CH-05', 'Quick filter tabs', 'Chrome'],
  ['CH-06', 'Panel tab strip', 'Chrome'],
  ['CH-07', 'Numbered card header', 'Chrome'],
  ['CH-08', 'Mobile drawer trigger', 'Chrome'],
  ['CH-09', 'Hero band · route', 'Chrome'],
  ['CH-10', 'Hero band · search', 'Chrome'],
  ['CH-11', 'Pagination', 'Chrome'],
  ['CH-12', 'Breadcrumb · text', 'Chrome'],
  ['CH-13', 'Hero band · track and trace', 'Chrome'],
  ['CH-14', 'Listing hero · pipeline band', 'Chrome'],
  ['AC-01', 'Buttons on light', 'Actions'],
  ['AC-02', 'Buttons on dark', 'Actions'],
  ['AC-03', 'Pill CTA and icon buttons', 'Actions'],
  ['AC-04', 'View switcher and stepper', 'Actions'],
  ['IN-01', 'Fields', 'Form controls'],
  ['IN-02', 'Search and lane fields', 'Form controls'],
  ['IN-03', 'Segmented, switch, checkbox, radio', 'Form controls'],
  ['IN-04', 'Range slider', 'Form controls'],
  ['SE-01', 'Transport mode cards', 'Selection'],
  ['SE-02', 'Radio cards', 'Selection'],
  ['SE-03', 'Chip toggles', 'Selection'],
  ['SE-04', 'Container selector', 'Selection'],
  ['SE-05', 'Selected summary strip', 'Selection'],
  ['SE-06', 'Party cards', 'Selection'],
  ['DA-01', 'Attention cards', 'Data display'],
  ['DA-02', 'Stat tiles with spark bars', 'Data display'],
  ['DA-03', 'Data table with route progress', 'Data display'],
  ['DA-04', 'Milestone tracker', 'Data display'],
  ['DA-05', 'Mode ladder bar chart', 'Data display'],
  ['DA-06', 'Ring gauge and fact list', 'Data display'],
  ['DA-07', 'Sparkline trend', 'Data display'],
  ['DA-08', 'Status chips and badges', 'Data display'],
  ['DA-09', 'Summary list and checklist', 'Data display'],
  ['DA-10', 'Vertical timeline', 'Data display'],
  ['FB-01', 'Notices', 'Feedback'],
  ['FB-02', 'Empty state and attachments', 'Feedback'],
  ['FB-03', 'Confirmation dialog', 'Feedback'],
  ['FB-04', 'Filter drawer', 'Feedback'],
  ['SP-01', 'Autocomplete, free text accepted', 'Specialised'],
  ['SP-02', 'Compact scrollbar', 'Specialised'],
  ['SP-03', 'Multimodal leg breakdown', 'Specialised'],
  ['SP-04', 'Container utilisation', 'Specialised'],
  ['SP-05', 'Free time and demurrage meter', 'Specialised'],
  ['SP-06', 'Charge breakdown', 'Specialised'],
  ['SP-07', 'Incoterm handover strip', 'Specialised'],
  ['SP-08', 'Vessel rotation strip', 'Specialised'],
  ['SP-09', 'CO₂e calculator', 'Specialised'],
  ['LD-01', 'Route loader', 'Loading'],
  ['LD-02', 'Container fill · determinate', 'Loading'],
  ['LD-03', 'Inline waits', 'Loading'],
  ['LD-04', 'Skeleton rows', 'Loading'],
  ['LD-05', 'Cold start splash · dark', 'Loading'],
  ['LD-06', 'Cold start splash · light', 'Loading'],
  ['LD-07', 'Cold start · loading bays', 'Loading'],
  ['LD-08', 'Cold start · network rotation', 'Loading'],
  ['LD-09', 'Cold start · arrivals board', 'Loading'],
  ['LD-10', 'Boxless thread', 'Loading'],
  ['LD-11', 'Inline text wait', 'Loading'],
  ['LD-12', 'Transparent overlay', 'Loading'],
  ['LD-13', 'Compact spinners', 'Loading'],
  ['MS-01', 'Toasts', 'Messages'],
  ['MS-02', 'Field validation', 'Messages'],
  ['MS-03', 'Error summary', 'Messages'],
  ['MS-04', 'Notification centre', 'Messages'],
  ['MS-05', 'System banners', 'Messages'],
  ['MS-06', 'Page level errors', 'Messages'],
  ['DT-01', 'Date field treatments', 'Dates'],
  ['DT-02', 'Day picker', 'Dates'],
  ['DT-03', 'Date picker', 'Dates'],
  ['DT-04', 'Schedule picker', 'Dates'],
  ['CF-01', 'Quick quote · 5 entries', 'Forms'],
  ['CF-02', 'Book a quote · 2 entries', 'Forms'],
  ['CF-03', 'Inline cargo line', 'Forms'],
  ['CF-04', 'Form rules', 'Forms'],
  ['SH-01', 'Customer shell · no side rail', 'Shells'],
  ['SH-02', 'Staff shell · side rail', 'Shells'],
  ['SH-03', 'Mobile shell', 'Shells'],
  ['SH-04', 'Shell rules', 'Shells'],
];

/* ------------------------------------------------------------------------ */
/* Shared rendering parts                                                   */
/* ------------------------------------------------------------------------ */

function TokenTable({ specs, swatches }: { specs: readonly TokenSpec[]; swatches?: boolean }) {
  // Read once during the first render, so nothing sets state in an effect.
  const [checks] = useState<TokenCheck[]>(() => checkTokens(specs));
  return (
    <table className={styles.audit}>
      <thead>
        <tr>
          {swatches && <th scope="col" className={styles.swatchHead} />}
          <th scope="col">Role</th>
          <th scope="col">Token</th>
          <th scope="col">Resolved</th>
          <th scope="col">Against the mockup</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((check) => (
          <tr key={check.token}>
            {swatches && (
              <td>
                <span
                  className={styles.swatch}
                  style={{ '--swatch': `var(${check.token})` } as CSSProperties}
                />
              </td>
            )}
            <th scope="row">{check.name}</th>
            <td>
              <code>{check.token}</code>
            </td>
            <td>
              <code>{check.actual || '—'}</code>
            </td>
            <td className={check.matches ? styles.pass : styles.fail}>
              {check.matches ? 'matches' : `expected ${check.expected}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------------ */
/* Specimens — one entry per code, added as each is corrected               */
/* ------------------------------------------------------------------------ */

interface Specimen {
  /** What the component is for, in the mockup's terms. */
  intent: string;
  /** What was wrong before it was corrected. */
  corrected?: readonly string[];
  render: () => ReactNode;
}

const TYPE_SAMPLES: readonly {
  token: string;
  weight: number;
  leading: number;
  sample: string;
  caps?: boolean;
}[] = [
  { token: '--noa-text-page', weight: 800, leading: 1.25, sample: 'Shipment overview' },
  { token: '--noa-text-section', weight: 800, leading: 1.2, sample: 'Quotations in progress' },
  { token: '--noa-text-card', weight: 700, leading: 1.3, sample: 'Container utilisation' },
  {
    token: '--noa-text-body-kit',
    weight: 400,
    leading: 1.5,
    sample: 'We price every quote by hand, so a response carries a named owner.',
  },
  { token: '--noa-text-dense', weight: 700, leading: 1.3, sample: 'Gross weight' },
  { token: '--noa-text-eyebrow', weight: 700, leading: 1, sample: 'Reference', caps: true },
];

const SPECIMENS: Readonly<Record<string, Specimen>> = {
  'FN-01': {
    intent:
      'One action colour, one navy, two state colours and a warm neutral ramp. Brand red is for actions and errors only.',
    corrected: [
      'The page ground resolved to white. The kit puts white cards on #f5f5f3.',
      'Two status ramps were live at once: success was #1f8a4c and attention #b4780a.',
      'No token existed for the strong action tint (#f2d3d5) or the scroll thumb (#c9c9c7).',
    ],
    render: () => (
      <TokenTable
        swatches
        specs={[
          { name: 'Action', token: '--red-600', expected: '#aa272f' },
          { name: 'Action hover', token: '--red-700', expected: '#8e2027' },
          { name: 'Action tint', token: '--red-050', expected: '#f7ecec' },
          { name: 'Action tint strong', token: '--noa-action-tint-strong', expected: '#f2d3d5' },
          { name: 'Brand navy', token: '--navy-800', expected: '#002c5f' },
          { name: 'Ground (dark)', token: '--navy-950', expected: '#041c2c' },
          { name: 'Navy tint', token: '--noa-navy-050', expected: '#e8edf4' },
          { name: 'Success', token: '--noa-kit-success', expected: '#2e7d4f' },
          { name: 'Success tint', token: '--noa-kit-success-surface', expected: '#eaf4ee' },
          { name: 'Attention', token: '--noa-kit-attention', expected: '#b7791f' },
          { name: 'Attention tint', token: '--noa-kit-attention-surface', expected: '#fbf3e4' },
          { name: 'Ink', token: '--gray-900', expected: '#333333' },
          { name: 'Body', token: '--gray-700', expected: '#58595b' },
          { name: 'Muted', token: '--gray-400', expected: '#a7a7a6' },
          { name: 'Line', token: '--gray-200', expected: '#e5e5e5' },
          { name: 'Page ground', token: '--noa-ground', expected: '#f5f5f3' },
          { name: 'Panel', token: '--noa-paper', expected: '#fbfaf7' },
          { name: 'Track', token: '--noa-ring-track', expected: '#f0efec' },
          { name: 'Scroll thumb', token: '--noa-scroll-thumb', expected: '#c9c9c7' },
        ]}
      />
    ),
  },

  'FN-02': {
    intent:
      'Mulish at 400/600/700/800. Six steps: page 30, section 22, card 17, body 15, dense 13, eyebrow 11.',
    corrected: [
      'The ramp had no 30px, 17px, 15px, 13px or 11px step, so every step rendered one to two pixels off.',
      'The kit leaned on the two smallest tokens: 12px used 73 times, 10px used 54 times.',
    ],
    render: () => (
      <div className={styles.stack}>
        <div className={styles.typeSamples}>
          {TYPE_SAMPLES.map((sample) => (
            <p
              key={sample.token}
              className={sample.caps ? styles.capsSample : undefined}
              style={{
                fontSize: `var(${sample.token})`,
                fontWeight: sample.weight,
                lineHeight: sample.leading,
              }}
            >
              {sample.sample}
            </p>
          ))}
        </div>
        <TokenTable
          specs={[
            { name: 'Page title', token: '--noa-text-page', expected: '30px' },
            { name: 'Section title', token: '--noa-text-section', expected: '22px' },
            { name: 'Card title', token: '--noa-text-card', expected: '17px' },
            { name: 'Body', token: '--noa-text-body-kit', expected: '15px' },
            { name: 'Dense label', token: '--noa-text-dense', expected: '13px' },
            { name: 'Eyebrow', token: '--noa-text-eyebrow', expected: '11px' },
          ]}
        />
      </div>
    ),
  },

  'FN-03': {
    intent:
      'Three elevations and one inset. Cards carry a soft shadow on the page ground, raised is for dropdowns and panels over dark, modal is for dialogs.',
    corrected: [
      'All three shadow tiers resolved to the same value, and the card shadow was 0 1px 4px rgba(0,0,0,.08) rather than 0 2px 14px rgba(0,0,0,.10).',
      'No raised tier existed at all.',
    ],
    render: () => (
      <div className={styles.surfaces}>
        <div className={styles.card}>
          <strong>Card</strong>
          <span>White on the page ground, square corners, 0 2px 14px rgba(0,0,0,.10).</span>
        </div>
        <div className={styles.raised}>
          <strong>Raised</strong>
          <span>Dropdowns and panels over dark, 0 6px 22px rgba(0,0,0,.18).</span>
        </div>
        <div className={styles.inset}>
          <strong>Inset panel</strong>
          <span>Paper ground for table footers and read-back blocks.</span>
        </div>
        <div className={styles.modal}>
          <strong>Modal</strong>
          <span>Dialogs only, 0 20px 50px rgba(0,0,0,.35).</span>
        </div>
      </div>
    ),
  },

  'CH-04': {
    intent:
      'The trail drawn as a journey rather than a line of chevrons: a house, hairline connectors, an open ring for each place passed through and a filled marker with a halo on where you are. A freight customer is reading routes all day; this reads as one.',
    corrected: [
      'It did not exist. The shadcn breadcrumb primitive is a text trail with chevron separators — a different drawing, not a variant of this one, so it stays for CH-12 and this was built beside it.',
      'The current step carries aria-current="page", so the tint and the marker are never the only signal that this is where you are.',
      'The dark variant is not the light one with a colour swapped: on a hero band the edge, the hairline and the label all need their own alpha, which is why they are five tokens rather than one.',
    ],
    render: () => (
      <div className={styles.darkStage}>
        <RouteBreadcrumb
          label="Breadcrumb"
          homeHref="#"
          homeLabel="Dashboard"
          steps={[
            { id: 'quotations', label: 'Quotations', href: '#' },
            { id: 'new', label: 'New request' },
          ]}
        />
      </div>
    ),
  },

  'CH-09': {
    intent:
      'The dark band that opens a route-shaped page: the trail, what is being asked for, and the lane itself as origin, line and destination. It runs edge to edge while its contents stay on the page measure, and keeps 96px of empty navy at its foot for the first card to climb into.',
    corrected: [
      'It did not exist. Pages drew their own navy strip, so the request page and the detail pages had three different heroes.',
      'The band drops the radial rings the sign-in hero uses and keeps only the hairlines: a ring behind a card that rises into the band reads as a printing fault.',
      'The route strip is a drawing of the lane, not a progress bar. The run stops at half width and never moves, so nobody reads it as "halfway there".',
    ],
    render: () => (
      <HeroBand
        eyebrow="IMPORT · SEA FCL · PORT TO DOOR"
        breadcrumb={
          <RouteBreadcrumb
            label="Breadcrumb"
            homeHref="#"
            homeLabel="Dashboard"
            steps={[
              { id: 'quotations', label: 'Quotations', href: '#' },
              { id: 'new', label: 'New request' },
            ]}
          />
        }
        route={{
          fromCode: 'CNTAO',
          fromLabel: 'Qingdao, China',
          toCode: 'ESVLC',
          toLabel: 'Valencia, Spain',
          icon: 'container-ship',
          label: 'Qingdao, China to Valencia, Spain',
        }}
        chips={
          <>
            <HeroChip tone="solid">Sea FCL</HeroChip>
            <HeroChip>Import</HeroChip>
            <HeroChip>FOB Qingdao port</HeroChip>
            <HeroChip>Port to door</HeroChip>
          </>
        }
      />
    ),
  },

  'CH-14': {
    intent:
      'The band that opens a LIST page, where CH-09 opens a page about one thing. It carries who is looking, what they are looking at, and one bar cut into the states everything in the list is in. The listing then climbs 44px into the empty foot of the band.',
    corrected: [
      'The bar is the status filter, not a picture of one. A band that only reported would be a decoration and the screen would still need a status control somewhere else — so picking a segment filters the grid, and the toolbar has no status control at all.',
      'Picking a segment dims the others rather than hiding them. A band whose other five numbers fall to zero the moment you use it is a band nobody can navigate with.',
      'The bar and the chips are one control shown twice, so the bar is aria-hidden and the chips carry the labels. Announcing both reads the six states out twice to anyone who cannot see they are one row of colour.',
      'A segment at zero is not drawn: it is not a state this list is in, and an empty sliver tells you nothing.',
      'The band renders `data-bleed`, which the staff shell reads to drop its own 32px padding. The band has to reach the rail and the window edge; its own measure is what keeps the content off them.',
    ],
    render: () => <ListingHeroSpecimen />,
  },

  'IN-02': {
    intent:
      'A field with a maintained list behind it that still takes anything. Pick the maintained value in one click; type the one nobody has added yet. Used for commodity descriptions, packaging names, countries and carriers — lists that are a convenience, never a rule.',
    corrected: [
      'It was a native `datalist`, so the list was drawn by the browser: a black OS panel hanging off a Noatum field, different in Chrome, Firefox and Safari, and deaf to every token. The list is ours now.',
      'The input is still a plain text input. Typing, maxLength, onChange and form behaviour are untouched, and a chosen suggestion is applied through the caller\'s own onChange — so no call site had to change and none can tell a click from a keystroke.',
      'Matching folds case and accents, so "espana" finds "España". The exact spelling is compared raw, so the accented form is still offered rather than hidden as a duplicate.',
      'The panel is portalled to the body: the packaging field lives in a horizontally scrolling row, which clipped a list positioned inside it.',
      'Arrow keys walk the list, Enter takes the highlighted row, Escape closes without changing what was typed — and Enter with nothing highlighted still submits the form, which is what Enter in a text field is for.',
    ],
    render: () => <ComboInputSpecimen />,
  },

  'CH-11': {
    intent:
      'Rows-per-page select, then one outlined control group: previous, the red page rule, the page counter, next and last. That order, that grouping.',
    corrected: [
      'Three paginations existed. This is the one the listing grid already uses, so it was corrected rather than replaced; the unused KitPagination and the shadcn pagination primitive are duplicates.',
      'The shadcn pagination primitive is a numbered link list (1 2 3 …), a different interaction from CH-11, so it was removed rather than wrapped.',
      'The rows-per-page select sat inside the arrow group. The kit gives it its own outline, 12px away.',
      'The page rule was a percentage-width progress bar. The kit draws a fixed 42x5 rule — it marks the control group, it does not measure anything. That also removed the only inline style in the design system.',
      'Groups were 38px tall with a 4px radius and the table line. The kit uses 40px, a 6px radius and a slightly darker group line (#d8d8d6).',
      'Arrows were brand red. The kit draws them muted, and tints the action colour only on hover.',
      'The nav was labelled with its own page counter, so the landmark announced "Page 3 of 12". It now takes a navLabel.',
    ],
    render: () => <PaginationSpecimen />,
  },

  'DA-02': {
    intent:
      'A figure, a semantic top rail, and a short history underneath. The bars are finite heights rather than a chart, so the tile stays cheap and legible at 190px.',
    corrected: [
      'The cva default tone disagreed with the component default, so the declared default and the applied one differed.',
      'Bar heights were unclamped, so a value above 100 overflowed the tile.',
      'The bar row had no accessible name — a row of shapes with no caption tells a screen reader nothing. `barsLabel` is required alongside bars.',
      'The tile was clickable whether or not a handler existed. It is a button only when onSelect is supplied.',
    ],
    render: () => (
      <div className={styles.tileGrid}>
        <StatTile
          label="Need attention"
          value="2"
          tone="action"
          barsLabel="Six weeks to 20.09"
          bars={[
            { value: 40 },
            { value: 65 },
            { value: 30 },
            { value: 80, emphasis: true },
            { value: 55 },
            { value: 100, emphasis: true },
          ]}
        />
        <StatTile
          label="In transit"
          value="12"
          tone="navy"
          barsLabel="Six weeks to 20.09"
          bars={[
            { value: 50 },
            { value: 70 },
            { value: 60 },
            { value: 90, emphasis: true },
            { value: 75 },
            { value: 85 },
          ]}
        />
        <StatTile
          label="Delivered"
          value="48"
          tone="success"
          barsLabel="Six weeks to 20.09"
          bars={[
            { value: 60 },
            { value: 45 },
            { value: 80 },
            { value: 70 },
            { value: 95, emphasis: true },
            { value: 100, emphasis: true },
          ]}
        />
      </div>
    ),
  },

  'DA-03': {
    intent:
      'Origin and destination with a track between them and the mode riding it. Small enough to live in a table row, and it doubles as the row’s progress.',
    corrected: [
      'The line and the marker used two different mappings — the line wrote the raw percentage into x2, the marker used `value - 5` clamped to 0–90 and scaled — so they disagreed at every value.',
      'Writing a percentage straight into an SVG coordinate collapsed 0–2% and 98–100% into the caps, and at 0 the done line started left of the track.',
      'Both now go through scaleToTrack, so they cannot drift apart.',
      'The cell had no accessible name and announced no progress.',
    ],
    render: () => (
      <div className={styles.routeGrid}>
        <RouteProgress origin="CNSHA" destination="ESVLC" progress={0} modeIcon="container-ship" label="Shanghai to Valencia" />
        <RouteProgress origin="CNSHA" destination="ESVLC" progress={62} modeIcon="container-ship" label="Shanghai to Valencia" />
        <RouteProgress origin="DEFRA" destination="USJFK" progress={88} modeIcon="air-freight" label="Frankfurt to New York" />
        <RouteProgress origin="ESVLC" destination="ESRIB" progress={100} modeIcon="truck" label="Valencia to Ribarroja" />
      </div>
    ),
  },

  'DA-05': {
    intent:
      'Horizontal bars on a #F0EFEC track: the chosen mode in the action colour, the best on this measure in success green, the rest neutral. Plain markup, no chart library.',
    corrected: [
      'The scale came from `Math.max(...items.map(…))`, so a single non-finite value made every bar in the group NaN wide. It goes through clampProgress.',
      'All values at zero produced a zero maximum and full bars. The maximum is floored at 1.',
      'Chosen and best were signalled by colour alone. Both now carry a visually hidden word.',
      'Every row was clickable whether or not a handler existed. A row is a button only when one is supplied.',
    ],
    render: () => <ModeLadderSpecimen />,
  },

  'DA-06': {
    intent:
      'A 12px ring on a #F0EFEC track, drawn from twelve o’clock, beside the same numbers written out as a fact list.',
    corrected: [
      'The value was never rounded, so the ring announced "Fill: 33.33333333%". A screen reader reads every one of those digits.',
      'A circumference of 276.46 was hard-coded in three places against `r="44"`. It is derived once.',
      'The percent sign was hard-coded; the announced wording is now the caller’s through formatValueText.',
    ],
    render: () => (
      <RingGauge
        value={61}
        label="Emissions against the worst mode"
        caption="of worst"
        formatValueText={(percent) => `${percent}% of the worst mode`}
        facts={[
          { id: 'per-tonne', label: 'Per tonne', value: '14 kg' },
          { id: 'distance', label: 'Distance', value: '19,400 km' },
          { id: 'mode', label: 'Mode', value: 'Sea FCL' },
        ]}
      />
    ),
  },

  'DA-07': {
    intent:
      'A filled area and a 2.5px line as plain SVG, with the series repeated as a hidden table so the figures are readable, not just the shape.',
    corrected: [
      'A single point drew an invisible path plus a spurious filled triangle. Fewer than two points renders the empty state.',
      'The chart exposed no values at all — a path has none, and the trend badge does not say what the shape was. There is a table now, referenced by aria-describedby.',
      'A flat series divided by a zero range and produced NaN coordinates.',
      'Points that are not numbers are dropped rather than breaking the path.',
    ],
    render: () => (
      <SparklineTrend
        title="Carbon intensity trend"
        description="kg CO₂e per tonne shipped"
        chartLabel="Carbon intensity, April to September"
        trend="Down 12%"
        valueHeading="kg CO₂e"
        points={[58, 50, 54, 38, 34, 26]}
        labels={['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP']}
        empty="Not enough history yet"
      />
    ),
  },

  'DT-01': {
    intent:
      'A shipping date is never just a number: the weekday decides whether a sailing exists, the week number is how carriers talk, and the distance from today is what the customer feels. Three ways to show the same date, each carrying all three, plus the form field that asks for one.',
    corrected: [
      'No variant emitted `<time dateTime>`, so the date was not machine-readable in any treatment.',
      'The separator between year and week number was hard-coded.',
      'Withdrawn from the earlier critique: the spelled month is not a brand breach. The kit deliberately shows both — "Fri 25 SEP 2026" for reading and 25.09.2026 as the numeric form in the chip.',
      'Variant D was missing entirely, so a form asking for a date had nowhere to put one and pages dropped the bare DT-03 grid inline — permanently open, taking a third of the screen. D is a disclosure on the shadcn popover: portalled to the body, closing on outside click, Escape and selection, and returning focus to the field.',
    ],
    render: () => <DateDisplaySpecimen />,
  },

  'DT-02': {
    intent:
      'Seven cells for the weekdays a service runs or a collection is possible. Used on sailing schedules, recurring bookings and warehouse opening days, and it feeds the calendar in DT-03.',
    corrected: [
      'Values came back in click order, so a caller rendering "Tue and Fri" could get "Fri and Tue". They are sorted into week order.',
      'The cells were buttons in a plain group with no pressed state. They are a Radix toggle group.',
      'A single letter is all a sighted user needs, but "M" is not a weekday to a screen reader. Each cell carries its full name.',
    ],
    render: () => <DayPickerSpecimen />,
  },

  'DT-03': {
    intent:
      'A compact month grid: sailing days carry a red dot and a tinted cell, today is ringed navy, past dates are dead, and the shortcuts sit on the left so most people never open the grid at all.',
    corrected: [
      'No locale reached react-day-picker, so month and weekday names shipped English whatever the app language — a breach i18next cannot fix from outside the component.',
      'A sailing day was a tint and nothing else. It now carries a drawn dot as well.',
      'There was no way to bound the calendar: no startMonth, no endMonth, so "no dates before today" relied entirely on the caller.',
    ],
    render: () => <DatePickerSpecimen />,
  },

  'DT-04': {
    intent:
      'One control for a recurring booking: the start date from the grid, the weekdays from the day picker, and a sentence reading back what was actually agreed.',
    corrected: [
      'It hand-rolled a popover with no Escape, no outside click, no focus management and no z-index. It is not a popover at all now — the grid opens in place, beneath the fields, so the read-back sentence never moves and the page never jumps.',
      'Choosing a date did not close the grid. There is a Done action.',
      'Composed from DT-01, DT-02 and DT-03 rather than redrawing any of them.',
    ],
    render: () => <SchedulePickerSpecimen />,
  },

  'LD-01': {
    intent:
      'The lane the user asked about becomes the progress bar: the mode marker sails from origin to destination and the work behind the scenes ticks off as it goes. Waiting reads as movement on their own shipment, not a generic delay.',
    corrected: [
      'The whole card was wrapped in `aria-live`, so every prop change re-announced the route, the ports and every step. Only the message line is the live region now.',
      'Step state was a coloured dot alone. Done and current also say so in words.',
      'A reduced-motion user saw the wake at zero width and the marker parked on the origin, which reads as a stalled shipment. Both have static states.',
    ],
    render: () => (
      <RouteLoader
        eyebrow="Searching Sea FCL · import"
        estimate="Usually under 20 seconds"
        originCode="CNTAO"
        originName="Qingdao"
        destinationCode="ESVLC"
        destinationName="Valencia"
        modeIcon="container-ship"
        message="Asking 14 carriers for space on this lane"
        doneLabel="done"
        currentLabel="in progress"
        steps={[
          { id: 'lane', label: 'Matching the lane', state: 'done' },
          { id: 'carriers', label: 'Asking carriers for space', state: 'current' },
          { id: 'surcharges', label: 'Checking surcharges', state: 'waiting' },
          { id: 'transit', label: 'Confirming transit times', state: 'waiting' },
        ]}
      />
    ),
  },

  'LD-02': {
    intent:
      'For work with a known size — uploading a packing list, generating documents, exporting a report. The container fills, and the count says what is actually being processed.',
    corrected: [
      'The fill was passed straight to the element, so a zero total drew a full container. It goes through clampProgress.',
      'A caller that cannot count had to invent a percentage. Omitting value and max now gives an indeterminate fill instead.',
      'The announced label carries the percentage, so the wait says how far along it is rather than only that it is happening.',
    ],
    render: () => (
      <div className={styles.stack}>
        <ContainerFill
          label="Generating documents"
          value={18}
          max={24}
          detail="18 of 24 documents"
        />
        <ContainerFill label="Uploading the packing list" detail="Size unknown" />
      </div>
    ),
  },

  'LD-11': {
    intent:
      'For a figure or a cell that is still resolving: the text stays, a marker crosses between the two codes, or three dots breathe after the label. Nothing shifts when the value lands.',
    corrected: [
      'A cell that collapses to a spinner and reappears moves the row under the reader’s eye. Both variants keep their footprint, including under reduced motion.',
    ],
    render: () => (
      <div className={styles.stack}>
        <InlineTextWait label="Finding the transit time" from="CNTAO" to="ESVLC" />
        <InlineTextWait variant="dots" label="Calculating chargeable weight" text="Chargeable weight" />
      </div>
    ),
  },

  'LD-12': {
    intent:
      'When a view is refreshing in place, the content stays readable at 45% and only the thread and one line of copy sit over it. No panel, no blur, no spinner in the middle of the screen.',
    corrected: [
      'The overlay caught clicks on the content beneath it. Dimming is a signal, not a lock, so it is pointer-transparent and the rows stay interactive.',
      'It nested a status region inside another. One region, on the overlay, and only while busy.',
    ],
    render: () => <RefreshOverlaySpecimen />,
  },

  'LD-04': {
    intent:
      'Lists and tables hold their shape while they load, so nothing jumps when the rows land. The sweep runs left to right, the same direction as the route.',
    corrected: [
      'The headings used to shimmer along with the cells, which tells the user nothing about what is coming. They stay real text; only the cells are placeholders.',
      'Built on the shadcn Skeleton, so the shimmer is defined once rather than per component.',
      'The placeholder rows are hidden from assistive technology — one label announces the wait instead of thirty empty cells.',
    ],
    render: () => (
      <SkeletonRows
        label="Loading shipments"
        headings={['REFERENCE', 'ROUTE', 'MODE', 'STATUS']}
        rows={5}
      />
    ),
  },

  'LD-05': {
    intent:
      'Only for the first paint after sign-in. The wordmark sits on the deep ground and a single red leg draws underneath it, left to right — the whole brand gesture in one line.',
    corrected: [
      'The leg is two layers, not one: a clipped line that grows, and a separate layer carrying an 8px dot that rides its leading edge. Only the line was built, so the gesture had no head.',
      'Five splash variants each hand-rolled their own markup. They are one component with a variant, sharing one live region and one set of static states.',
      'A cold start frozen mid-sequence looks broken, so every staged element settles at its finished state under reduced motion.',
    ],
    render: () => (
      <ColdStart
        variant="dark"
        brand="NOATUM"
        brandSuffix="LOGISTICS"
        label="Preparing your portal"
        message="Loading your shipments, quotes and invoices"
      />
    ),
  },

  'LD-06': {
    intent:
      'The same gesture on the page ground, for the internal workspace and for print-adjacent views where the dark band would be too heavy. A light sweep passes over the wordmark once per cycle.',
    corrected: [
      'The wordmark is navy here, not ink, and it carries a 38px gradient sweep that was missing entirely.',
      'The track is the line colour rather than the dark ring, and the message is muted rather than on-dark.',
    ],
    render: () => (
      <ColdStart
        variant="light"
        brand="NOATUM"
        brandSuffix="LOGISTICS"
        label="Preparing the workspace"
        message="Loading the Valencia pricing queue"
      />
    ),
  },

  'LD-08': {
    intent:
      'The rotation lighting up node by node — the ports on the lane coming online in turn, so the wait shows the network rather than a bar.',
    corrected: ['Shares the ColdStart live region and static states.'],
    render: () => (
      <ColdStart
        variant="network"
        brand="NOATUM"
        brandSuffix="LOGISTICS"
        label="Connecting to the network"
        items={[
          { id: 'cntao', label: 'Qingdao', value: 'CNTAO', tone: 'success' },
          { id: 'sgsin', label: 'Singapore', value: 'SGSIN' },
          { id: 'egsuz', label: 'Suez', value: 'EGSUZ' },
          { id: 'esvlc', label: 'Valencia', value: 'ESVLC' },
        ]}
      />
    ),
  },

  'LD-07': {
    intent:
      'Five bays fill in sequence and hold, the way a vessel is stowed. Each bay is one module coming online, named underneath, so the wait doubles as a map of the platform.',
    corrected: ['Shares the ColdStart live region: one announcement, not five bay names arriving one at a time.'],
    render: () => (
      <ColdStart
        variant="bays"
        brand="NOATUM"
        brandSuffix="LOGISTICS"
        label="Bringing the platform online"
        items={[
          { id: 'track', label: 'Tracking' },
          { id: 'quotes', label: 'Quotations' },
          { id: 'docs', label: 'Documents', tone: 'success' },
          { id: 'invoices', label: 'Invoices' },
          { id: 'alerts', label: 'Alerts', tone: 'attention' },
        ]}
      />
    ),
  },

  'LD-09': {
    intent:
      'The user’s own counts drop in one line at a time, like a terminal board. By the time the app is ready they have already read their morning: what moves, what waits on them, what is owed.',
    corrected: ['Same component, board variant. The counts are decoration until the app is ready, so they are hidden from assistive technology behind the single label.'],
    render: () => (
      <ColdStart
        variant="board"
        brand="NOATUM"
        brandSuffix="LOGISTICS"
        label="Reading your morning"
        items={[
          { id: 'transit', label: 'In transit', value: '12' },
          { id: 'attention', label: 'Need attention', value: '2', tone: 'action' },
          { id: 'quotes', label: 'Quotes awaiting you', value: '3', tone: 'attention' },
          { id: 'delivered', label: 'Delivered this week', value: '48', tone: 'success' },
        ]}
      />
    ),
  },

  'LD-10': {
    intent:
      'No card, no scrim, nothing to lay out around: a 2px thread pinned under a header or above a table while it refreshes.',
    corrected: [
      'It is the lightest wait in the kit and the right one whenever the content below stays readable — so it takes an `announce` prop and stops announcing when a parent already does.',
    ],
    render: () => (
      <div className={styles.stack}>
        <LoadingThread label="Refreshing shipments" />
        <p className={styles.mutedNote}>Pinned above a table that is still readable.</p>
      </div>
    ),
  },

  'LD-13': {
    intent:
      'Five treatments at four sizes, none above 20px. The kit has no large centred spinner on purpose: a wait big enough to need one should say what it is doing, which is LD-01’s job.',
    corrected: [
      'An `aria-label` was set on a `role="status"` that also rendered the same text, so the attribute overrode the visible label. When the label is shown it is no longer set as an attribute.',
      'Nested waits announced twice. `announce={false}` exists for a spinner inside something that already speaks.',
      'The sweep variant froze at zero width for a reduced-motion user. It pins to a filled track instead.',
    ],
    render: () => (
      <div className={styles.row}>
        <Spinner label="Loading" variant="arc" size={20} />
        <Spinner label="Loading" variant="twin" size={20} />
        <Spinner label="Loading" variant="sweep" size={20} />
        <Spinner label="Loading" variant="orbit" size={20} />
        <Spinner label="Loading" variant="cube" size={16} />
        <Spinner label="Saving your changes" visibleLabel size={16} />
      </div>
    ),
  },

  'SE-05': {
    intent:
      'What the user has chosen so far, on the paper ground, each entry with a red left rail. A read-back, not a control: the choosing happens above it.',
    corrected: [
      'Remove was `onRemove && removeLabel` — supplying the handler without the label rendered a button with no accessible name, silently. They are now one required object.',
      'Removing the focused item dropped focus to the document body. Focus moves to the next remove button, or to the strip if that was the last.',
      'There was no empty state.',
    ],
    render: () => <SelectedStripSpecimen />,
  },

  'SE-06': {
    intent:
      'One role in the shipment, its chosen party, and the line that says who that actually is. The card owns the label and the control’s id, so the role is always announced with the control.',
    corrected: [
      'The card supplied no label for the control it wrapped, so a select inside it announced only its options. The role now names it through aria-labelledby.',
      'Tone was decorative and carried no meaning on its own — the role name is the signal, the colour only reinforces it.',
      'There was no validation slot for the party the card holds.',
    ],
    render: () => (
      <div className={styles.partyGrid}>
        <PartyCard role="Shipper" detail="Pudong warehouse, CN · contact Wei Zhang">
          <Select
            label="Shipper"
            labelHidden
            value="qingdao"
            onValueChange={() => {}}
            options={[
              { value: 'qingdao', label: 'Qingdao Furniture Works' },
              { value: 'new', label: 'Add a new party…' },
            ]}
          />
        </PartyCard>
        <PartyCard
          role="Notify party"
          tone="navy"
          badge="Same as consignee"
          detail="Receives arrival notice and documents"
        >
          <Select
            label="Notify party"
            labelHidden
            value="same"
            onValueChange={() => {}}
            options={[
              { value: 'same', label: 'Same as consignee' },
              { value: 'new', label: 'Add a new party…' },
            ]}
          />
        </PartyCard>
      </div>
    ),
  },

  'SP-03': {
    intent:
      'Door-to-door transit split into pre-carriage, terminal dwell, main leg and on-carriage. Widths are proportional to days, so dwell time is impossible to hide.',
    corrected: [
      'Widths came from an unguarded reduce, so one non-finite value blanked every segment.',
      'Dwell was shaded and nothing else. It is named in text, because hidden dwell is exactly what this chart exists to expose.',
      'The bar had no accessible name and no text equivalent. Every segment is now written out with its days and share.',
    ],
    render: () => (
      <LegBreakdown
        title="Qingdao → Ribarroja · door to door"
        summary="38 days total · 4 legs, 2 dwell periods"
        chartLabel="Transit time by leg"
        dwellLabel="dwell"
        legs={[
          { id: 'pre', label: 'Pre-carriage', detail: 'Works to Qingdao', value: 3, valueLabel: '3 days', icon: 'truck', tone: 'navy' },
          { id: 'origin-dwell', label: 'Origin terminal', detail: 'Awaiting vessel', value: 5, valueLabel: '5 days', icon: 'terminal-gate', tone: 'attention', dwell: true },
          { id: 'main', label: 'Main freight', detail: 'Qingdao to Valencia', value: 24, valueLabel: '24 days', icon: 'container-ship', tone: 'action' },
          { id: 'dest-dwell', label: 'Destination terminal', detail: 'Customs and release', value: 4, valueLabel: '4 days', icon: 'customs-cleared', tone: 'attention', dwell: true },
          { id: 'on', label: 'On-carriage', detail: 'Valencia to Ribarroja', value: 2, valueLabel: '2 days', icon: 'truck', tone: 'neutral' },
        ]}
      />
    ),
  },

  'SP-04': {
    intent:
      'Volume and payload read against the same container, with the binding constraint called out. The fill rises inside the drawn container face and the water line carries its own figure.',
    corrected: [
      'Both bars passed their maximum straight to `<progress max>`. A zero maximum is invalid, so the browser substituted 1 and drew an empty container as completely full.',
      'The bars were wrapped in a `<label>`, which is not a labelable element, so both shipped with no accessible name at all.',
      'Percentages were never rounded.',
    ],
    render: () => (
      <ContainerUtilisation
        title="2 × 40' HC"
        constraint="Volume is the limit"
        chartLabel="Container utilisation"
        volume={{ name: 'Volume', value: 62.4, max: 76, valueLabel: '62.4 of 76 m³' }}
        payload={{ name: 'Payload', value: 17100, max: 28000, valueLabel: '17,100 of 28,000 kg' }}
        note="Volume binds first, so adding weight will not add cartons."
      />
    ),
  },

  'SP-05': {
    intent:
      'One day per cell: used, remaining, then chargeable days past the free period, with the running cost.',
    corrected: [
      'A row of coloured blocks said nothing to anyone who could not see it. Each cell names its own day and state.',
      'Day state was carried by colour alone.',
      'The excluded line is a prop, not a footnote — a demurrage figure without its exclusions is the one that gets disputed.',
    ],
    render: () => <FreeTimeMeterSpecimen />,
  },

  'SP-06': {
    intent:
      'Origin, freight, destination and delivery stacked to the all-in figure, each group proportional, so a quotation can be argued line by line.',
    corrected: [
      'Shares came from an unguarded reduce, so one non-finite value blanked every segment. They go through clampProgress.',
      'Percentages were never rounded.',
      'The stacked bar had no accessible name and no text equivalent. It is named, and every segment is repeated as a row.',
      'The excluded line is required, not a footnote: a charge total that does not name what it leaves out is how a quotation gets argued.',
    ],
    render: () => (
      <ChargeBreakdown
        title="All-in EUR 7,420"
        basis="per 2 × 40' HC · DAP Ribarroja"
        chartLabel="Charges by group"
        excludedLabel="Excluded"
        excluded="Duty and VAT, demurrage, storage after 14 days"
        groups={[
          {
            id: 'origin',
            label: 'Origin charges',
            detail: 'Haulage, THC, export customs, documents',
            value: 1180,
            amount: 'EUR 1,180',
            tone: 'navy',
          },
          {
            id: 'ocean',
            label: 'Ocean freight',
            detail: "2 × 40' HC including BAF and CAF",
            value: 4260,
            amount: 'EUR 4,260',
            tone: 'action',
          },
          {
            id: 'destination',
            label: 'Destination charges',
            detail: 'THC, release, import customs entry',
            value: 1480,
            amount: 'EUR 1,480',
            tone: 'neutral',
          },
          {
            id: 'delivery',
            label: 'Delivery and insurance',
            detail: 'Ribarroja haulage, 0.12% ad valorem',
            value: 500,
            amount: 'EUR 500',
            tone: 'tint',
          },
        ]}
      />
    ),
  },

  'SP-07': {
    intent:
      'The eleven stages of a door-to-door move coloured by who pays, with a marker where risk transfers. Cost and risk are separate questions and the strip answers both.',
    corrected: [
      'The strip scrolled horizontally with no tabIndex, so no keyboard could reach it below about 700px. It is a focusable region.',
      'Who pays was signalled by colour alone. Each stage states its payer, and the risk transfer, in text.',
      'The risk marker sat wherever the colour changed. It is its own flag on the stage that carries it.',
    ],
    render: () => (
      <IncotermStrip
        title="FOB · seller covers 6 of 11 stages"
        note="Seller pays to loading on board; risk passes at the ship’s rail."
        stripLabel="Incoterm handover stages"
        sellerLabel="Seller pays"
        buyerLabel="Buyer pays"
        riskLabel="Risk transfers"
        stages={[
          { id: 'packing', label: 'Export packing', payer: 'seller' },
          { id: 'loading-works', label: 'Loading at works', payer: 'seller' },
          { id: 'origin-haulage', label: 'Origin haulage', payer: 'seller' },
          { id: 'export-customs', label: 'Export customs', payer: 'seller' },
          { id: 'origin-terminal', label: 'Origin terminal', payer: 'seller' },
          { id: 'loading-board', label: 'Loading on board', payer: 'seller', riskTransfers: true },
          { id: 'main-freight', label: 'Main freight', payer: 'buyer' },
          { id: 'insurance', label: 'Insurance', payer: 'buyer' },
          { id: 'destination-terminal', label: 'Destination terminal', payer: 'buyer' },
          { id: 'import-customs', label: 'Import customs', payer: 'buyer' },
          { id: 'destination-haulage', label: 'Destination haulage', payer: 'buyer' },
        ]}
      />
    ),
  },

  'SP-09': {
    intent:
      'Compare transport modes on one lane: pick the lane, the mode and the weight, and read the estimate against every other mode the lane is served by. A customer choosing between sea and air is choosing between two numbers, and this is where they see both.',
    corrected: [
      'It lived in `shared/components`, outside the kit, so it was neither in this gallery nor reusable beside a quotation or a shipment. It is SP-09 now, and the half that fetches stayed behind in `shared`.',
      'It calculates nothing. Every figure arrives formatted, because a number the customer sees must have exactly one implementation and it is the server\'s — a copy of the arithmetic in the browser is how the panel ends up disagreeing with the quotation.',
      'A mode the lane does not serve is dimmed and disabled rather than removed: "air does not serve this lane" is the information, and a chip that vanishes teaches nothing.',
      'The comparison bars are floored at 2%, so a mode that emits almost nothing is still visibly on the chart rather than missing from it.',
      'The figure and its unit share one accessible name, so a screen reader reads "5,386 kg CO₂e" rather than a number and an orphaned unit.',
    ],
    render: () => <Co2CalculatorSpecimen />,
  },

  'SE-01': {
    intent:
      'A single choice drawn as cards. The 2px border turns to the action colour when selected and the icon tile inverts with it. The grid is auto-fit from 150px, so it reflows rather than scrolling.',
    corrected: [
      'The cards were `<button>` elements in a `role="group"`, so assistive technology announced a row of buttons rather than one choice, and every card sat in the tab order.',
      'Built on the Radix radio group now: arrow keys move between cards, only the selected card is tabbable, and the whole card is the target.',
      'The shadcn RadioGroupItem is a 16px dot whose Tailwind classes fight a card-shaped control, so the primitive gained a `RadioGroupCard` that carries no styling of its own.',
    ],
    render: () => <ModeCardsSpecimen />,
  },

  'SE-02': {
    intent:
      'The quieter sibling of SE-01: a 1px border, a drawn ring, and the label on one line. For a scope or a preference rather than a mode.',
    corrected: [
      'Same as SE-01 — real radio semantics instead of buttons, on the same primitive, so the two behave identically from the keyboard.',
      'The ring is decorative and is now hidden from the accessible name, which previously read the dot as part of the label.',
    ],
    render: () => <RadioCardsSpecimen />,
  },

  'SE-03': {
    intent:
      'Several answers as pills with a drawn checkbox, and below them one answer as smaller pills with counts. The checkbox is what tells you the first group is a multiple choice.',
    corrected: [
      'Both groups were `<span role="button">`, so neither reported a pressed state and neither was a group. They are Radix toggle groups now — multiple above, single below.',
      'Radix single mode returns an empty string when the pressed pill is pressed again, which would clear a filter meant always to carry a value. That is held.',
      'The drawn checkbox is hidden from the accessible name, which previously read it as part of the label.',
    ],
    render: () => <ChipTogglesSpecimen />,
  },

  'SE-04': {
    intent:
      'A drawn container face, a stepper, and a payload slider whose meter runs green while there is room and turns to the action colour past the type’s limit.',
    corrected: [
      'The 95% threshold was hard-coded inside the component. It is commercial policy, so it is now a `warnAt` prop and the kit value is only the default.',
      'The payload slider unmounted when the count reached zero, discarding the entered weight and dropping focus to the document body. It now stays and disables.',
      'The payload was a raw `<input type="range">`. It is the shadcn slider, which brings keyboard support with it.',
      'Radix leaves the slider thumb unnamed — it carries `role="slider"` and nothing else. The primitive now takes `thumbLabel` and `thumbValueText`.',
      'A zero payload limit rendered a full meter, because `<progress max="0">` is invalid and the browser substitutes 1. The meter goes through `clampProgress`.',
      'Over the threshold, only the colour changed. An `overLabel` now says so in words.',
      'The kit draws one card; the container lookup carries twelve. Twelve in a wrapping grid is four rows of tall cards in the middle of a form, so past three they go on a CardRail — one row, native scrolling, nothing unmounted.',
    ],
    render: () => (
      <>
        <ContainerSelectorSpecimen />
        <ContainerRailSpecimen />
      </>
    ),
  },

  'FN-06': {
    intent:
      'Square corners on cards, panels, tables and hero bands. Radius belongs to fields (4px), pills (20px) and avatars. Controls are 40 compact, 44 full form, 48 in the dark search panel.',
    corrected: [
      'Card padding was 12px against the kit measure of 20–26px.',
      'The 44px and 48px control heights did not exist.',
      'The space ramp had no 20px step, which the kit uses between page-level blocks.',
    ],
    render: () => (
      <div className={styles.stack}>
        <div className={styles.row}>
          <span className={styles.field}>Field · 4px</span>
          <span className={styles.pill}>Pill · 20px</span>
          <span className={styles.square}>Card · square</span>
        </div>
        <div className={styles.row}>
          <span className={styles.h40}>40 · compact</span>
          <span className={styles.h44}>44 · full form</span>
          <span className={styles.h48}>48 · dark search</span>
        </div>
        <TokenTable
          specs={[
            { name: 'Field / button radius', token: '--radius-btn', expected: '4px' },
            { name: 'Pill radius', token: '--noa-radius-filter-pill', expected: '20px' },
            { name: 'Card radius (square)', token: '--radius-none', expected: '0' },
            { name: 'Control · compact', token: '--noa-control-height-regular', expected: '40px' },
            { name: 'Control · full form', token: '--noa-control-height-full', expected: '44px' },
            { name: 'Control · dark search', token: '--noa-control-height-hero', expected: '48px' },
            { name: 'Card padding', token: '--noa-kit-card-padding', expected: '22px' },
            { name: 'Block gap', token: '--noa-kit-block-gap', expected: '20px' },
            { name: 'Card item gap', token: '--noa-kit-card-gap', expected: '16px' },
            { name: 'Chip gap', token: '--noa-kit-chip-gap', expected: '10px' },
          ]}
        />
      </div>
    ),
  },
};

function SelectedStripSpecimen() {
  const [items, setItems] = useState([
    { id: '40hc', title: "2 × 40' HC", detail: '17,100 kg each · 34,200 kg total' },
    { id: '20dv', title: "1 × 20' DV", detail: '9,400 kg' },
  ]);
  return (
    <div className={styles.stack}>
      <SelectedStrip
        label={`Selected · ${items.length} type${items.length === 1 ? '' : 's'}`}
        items={items}
        empty="Nothing selected yet"
        remove={{
          onRemove: (id) => setItems((current) => current.filter((item) => item.id !== id)),
          label: (item) => `Remove ${item.title}`,
        }}
      />
      {items.length < 2 && (
        <button
          type="button"
          className={styles.toggle}
          onClick={() =>
            setItems([
              { id: '40hc', title: "2 × 40' HC", detail: '17,100 kg each · 34,200 kg total' },
              { id: '20dv', title: "1 × 20' DV", detail: '9,400 kg' },
            ])
          }
        >
          Reset
        </button>
      )}
    </div>
  );
}

function RefreshOverlaySpecimen() {
  const [busy, setBusy] = useState(true);
  const rows = [
    ['S00482913', 'Shanghai → Valencia'],
    ['S00483344', 'Frankfurt → New York'],
    ['S00481990', 'Ningbo → Barcelona'],
    ['S00481744', 'Qingdao → Valencia'],
  ];
  return (
    <div className={styles.stack}>
      <RefreshOverlay busy={busy} label="Refreshing shipments">
        <div className={styles.stack}>
          {rows.map(([reference, route]) => (
            <p key={reference} className={styles.overlayRow}>
              <strong>{reference}</strong>
              <span>{route}</span>
            </p>
          ))}
        </div>
      </RefreshOverlay>
      <button type="button" className={styles.toggle} onClick={() => setBusy((on) => !on)}>
        {busy ? 'Finish refreshing' : 'Refresh again'}
      </button>
    </div>
  );
}

function FreeTimeMeterSpecimen() {
  // 14 free days, 3 of them still unused, then 3 chargeable.
  const days = [
    ...Array.from({ length: 11 }, (_, index) => ({
      id: `used-${index}`,
      label: `Day ${index + 1}, used`,
      state: 'used' as const,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `left-${index}`,
      label: `Day ${index + 12}, free time remaining`,
      state: 'remaining' as const,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `charge-${index}`,
      label: `Day ${index + 15}, chargeable`,
      state: 'chargeable' as const,
    })),
  ];
  return (
    <FreeTimeMeter
      title="Detention · MSCU 728 4410"
      status="3 days chargeable"
      meterLabel="Free time and demurrage, one cell per day"
      days={days}
      start="Gate out 22.08"
      freeTimeEnd="Free time ended 04.09"
      today="Today 07.09"
      facts={[
        { id: 'free', label: 'Free days', value: '14' },
        { id: 'used', label: 'Used', value: '11' },
        { id: 'chargeable', label: 'Chargeable', value: '3' },
        { id: 'cost', label: 'Running cost', value: 'EUR 285', emphasis: true },
      ]}
      excluded="Excludes port storage and any quay rent after release."
    />
  );
}

/* --------------------------------------------------------------- dates */

const SEP_25: DateParts = {
  dayNumber: '25',
  monthShort: 'SEP',
  year: '2026',
  weekday: 'Fri',
  weekNumber: 'W39',
  numeric: '25.09.2026',
  full: 'Fri 25 SEP 2026',
  relative: 'in 5 days',
  relativeTone: 'success',
  iso: '2026-09-25',
};

const WEEKDAYS = [
  { value: 'mon', shortLabel: 'M', fullLabel: 'Monday' },
  { value: 'tue', shortLabel: 'T', fullLabel: 'Tuesday' },
  { value: 'wed', shortLabel: 'W', fullLabel: 'Wednesday' },
  { value: 'thu', shortLabel: 'T', fullLabel: 'Thursday' },
  { value: 'fri', shortLabel: 'F', fullLabel: 'Friday' },
  { value: 'sat', shortLabel: 'S', fullLabel: 'Saturday' },
  { value: 'sun', shortLabel: 'S', fullLabel: 'Sunday' },
];

const SAILINGS = [new Date(2026, 8, 22), new Date(2026, 8, 25), new Date(2026, 8, 29)];

/** Everything the DT-03 grid needs, shared by the grid and the field that opens it. */
const CALENDAR = {
  calendarLabel: 'Cargo ready date',
  today: new Date(2026, 8, 20),
  startMonth: new Date(2026, 8, 1),
  sailingDates: SAILINGS,
  disabled: { before: new Date(2026, 8, 20) },
  shortcutsLabel: 'Shortcuts',
  shortcuts: [
    { id: 'today', label: 'Today', date: new Date(2026, 8, 20) },
    { id: 'tomorrow', label: 'Tomorrow', date: new Date(2026, 8, 21) },
    { id: 'sailing', label: 'Next sailing', date: new Date(2026, 8, 22) },
    { id: 'fortnight', label: 'In two weeks', date: new Date(2026, 9, 4) },
  ],
  legend: { chosen: 'Chosen', sailing: 'Sailing day', today: 'Today', past: 'Past' },
};

function DateDisplaySpecimen() {
  return (
    <div className={styles.dateGrid}>
      <div>
        <p className={styles.variantLabel}>A · Stamp</p>
        <DateDisplay variant="stamp" date={SEP_25} />
      </div>
      <div>
        <p className={styles.variantLabel}>B · Segmented line</p>
        <DateDisplay variant="line" date={SEP_25} relativePrefix="Cargo ready" />
      </div>
      <div>
        <p className={styles.variantLabel}>C · Compact chip</p>
        <DateDisplay variant="chip" date={SEP_25} />
      </div>
      <div>
        <p className={styles.variantLabel}>D · In a form row</p>
        <DateFieldSpecimen />
      </div>
    </div>
  );
}

function DateFieldSpecimen() {
  const [selected, setSelected] = useState<Date | undefined>(new Date(2026, 8, 25));
  return (
    <DateField
      label="Cargo ready"
      date={selected ? SEP_25 : undefined}
      placeholder="Choose a date"
      hint="Sailing days are marked in the calendar."
      selected={selected}
      onSelect={setSelected}
      calendar={CALENDAR}
    />
  );
}

function DayPickerSpecimen() {
  const [days, setDays] = useState(['tue', 'fri']);
  return (
    <DayPicker
      label="Collection days"
      options={WEEKDAYS}
      values={days}
      onValuesChange={setDays}
      summary={`${days.length} days a week`}
      next="Next Tue 22 SEP"
    />
  );
}

function DatePickerSpecimen() {
  const [selected, setSelected] = useState<Date | undefined>(new Date(2026, 8, 25));
  return (
    <DatePicker {...CALENDAR} selected={selected} onSelect={setSelected} />
  );
}

function SchedulePickerSpecimen() {
  const [open, setOpen] = useState(true);
  const [days, setDays] = useState(['tue', 'fri']);
  const [selected, setSelected] = useState<Date | undefined>(new Date(2026, 8, 25));
  return (
    <SchedulePicker
      dateLabel="First collection"
      date={SEP_25}
      selectedDate={selected}
      onDateChange={setSelected}
      weekdayLabel="Repeats on"
      weekdays={WEEKDAYS}
      selectedWeekdays={days}
      onWeekdaysChange={setDays}
      summary="Every Tue and Fri from Fri 25 SEP · next Tue 22 SEP"
      open={open}
      onOpenChange={setOpen}
      triggerLabel="Change the first collection date"
      doneLabel="Done"
      calendar={{
        calendarLabel: 'First collection date',
        month: new Date(2026, 8, 1),
        today: new Date(2026, 8, 20),
        sailingDates: SAILINGS,
        shortcutsLabel: 'Shortcuts',
        shortcuts: [
          { id: 'today', label: 'Today', date: new Date(2026, 8, 20) },
          { id: 'tomorrow', label: 'Tomorrow', date: new Date(2026, 8, 21) },
          { id: 'sailing', label: 'Next sailing', date: new Date(2026, 8, 22) },
          { id: 'fortnight', label: 'In two weeks', date: new Date(2026, 9, 4) },
        ],
      }}
    />
  );
}

function ModeLadderSpecimen() {
  const [picked, setPicked] = useState('rail');
  return (
    <ModeLadder
      label="Emissions by transport mode, Qingdao to Valencia"
      onSelect={setPicked}
      selectedLabel="chosen"
      preferredLabel="lowest emissions"
      items={[
        {
          id: 'sea',
          label: 'Sea FCL',
          detail: '32 days',
          value: 620,
          valueLabel: '620 kg',
          preferred: true,
          selected: picked === 'sea',
        },
        {
          id: 'rail',
          label: 'Rail',
          detail: '19 days',
          value: 1240,
          valueLabel: '1,240 kg',
          selected: picked === 'rail',
        },
        {
          id: 'road',
          label: 'Road',
          detail: '12 days',
          value: 2980,
          valueLabel: '2,980 kg',
          selected: picked === 'road',
        },
        {
          id: 'air',
          label: 'Air',
          detail: '3 days',
          value: 8400,
          valueLabel: '8,400 kg',
          selected: picked === 'air',
        },
      ]}
    />
  );
}

function ChipTogglesSpecimen() {
  const [services, setServices] = useState<string[]>(['customs']);
  const [mode, setMode] = useState('sea');
  return (
    <div className={styles.stack}>
      <ChipToggles
        showLabel
        label="Additional services"
        values={services}
        onValuesChange={setServices}
        options={[
          { value: 'insurance', label: 'Cargo insurance' },
          { value: 'customs', label: 'Customs clearance' },
          { value: 'inspection', label: 'Pre-shipment inspection' },
          { value: 'fumigation', label: 'Fumigation' },
          { value: 'reefer', label: 'Temperature control' },
        ]}
      />
      <FilterPills
        label="Mode"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: 'all', label: 'All', count: 24 },
          { value: 'sea', label: 'Sea', count: 18 },
          { value: 'air', label: 'Air', count: 6 },
          { value: 'road', label: 'Road' },
        ]}
      />
    </div>
  );
}

function ModeCardsSpecimen() {
  const [mode, setMode] = useState('sea-fcl');
  return (
    <ModeCards
      label="Transport mode"
      value={mode}
      onValueChange={setMode}
      options={[
        { value: 'sea-fcl', label: 'Sea FCL', description: 'Full container', icon: 'container-ship' },
        { value: 'sea-lcl', label: 'Sea LCL', description: 'Shared container', icon: 'container-ship' },
        { value: 'air', label: 'Air', description: 'Fastest transit', icon: 'air-freight' },
        { value: 'road', label: 'Road', description: 'Door to door', icon: 'truck' },
      ]}
    />
  );
}

function RadioCardsSpecimen() {
  const [scope, setScope] = useState('port-port');
  return (
    <RadioCards
      showLabel
      label="Scope requested"
      value={scope}
      onValueChange={setScope}
      options={[
        { value: 'port-port', label: 'Port to port' },
        { value: 'door-door', label: 'Door to door' },
        { value: 'door-port', label: 'Door to port' },
        { value: 'port-door', label: 'Port to door' },
      ]}
    />
  );
}

/** SE-04 only tells you anything while you are dragging it. */
/** The twelve types the container lookup actually carries. */
const CONTAINER_TYPES = [
  ["20' GP", '5.90 × 2.35 × 2.39 m', 21700],
  ["40' GP", '12.03 × 2.35 × 2.39 m', 26700],
  ["40' HC", '12.03 × 2.35 × 2.69 m', 28000],
  ["45' HC", '13.56 × 2.35 × 2.69 m', 27700],
  ["20' RF", '5.44 × 2.29 × 2.27 m', 21500],
  ["40' RF", '11.56 × 2.29 × 2.25 m', 27400],
  ["40' RH", '11.56 × 2.29 × 2.50 m', 27700],
  ["20' OT", '5.89 × 2.34 × 2.31 m', 21600],
  ["40' OT", '12.02 × 2.34 × 2.31 m', 26500],
  ["20' FR", '5.94 × 2.35 m', 31200],
  ["40' FR", '12.13 × 2.40 m', 39000],
  ["20' TK", '20 ft tank', 26000],
] as const;

/**
 * SE-04's own answer to twelve of them.
 *
 * The kit draws one card. The lookup carries twelve, and twelve of these in a
 * wrapping grid is four rows of tall cards in the middle of a form — so past
 * three they go on a rail.
 */
function ContainerRailSpecimen() {
  const [counts, setCounts] = useState<Record<string, number>>({ "40' HC": 2 });
  const [weights, setWeights] = useState<Record<string, number>>({ "40' HC": 17100 });
  const kg = (value: number) => `${value.toLocaleString('en-GB')} kg`;

  return (
    <CardRail
      label="Container types"
      previousLabel="Previous container types"
      nextLabel="More container types"
      positionLabel={({ first, last, total }) => `${first} to ${last} of ${total}`}
    >
      {CONTAINER_TYPES.map(([code, dimensions, limit]) => {
        const payload = weights[code] ?? 0;
        return (
          <ContainerSelector
            key={code}
            label={code}
            code={code}
            dimensions={dimensions}
            count={counts[code] ?? 0}
            onCountChange={(next) => setCounts((current) => ({ ...current, [code]: next }))}
            countLabel="Containers"
            decrementLabel={`One fewer ${code}`}
            incrementLabel={`One more ${code}`}
            payload={payload}
            payloadLimit={limit}
            onPayloadChange={(next) => setWeights((current) => ({ ...current, [code]: next }))}
            payloadLabel="Gross each"
            payloadUnit="kg"
            payloadValueText={`${kg(payload)} of ${kg(limit)}`}
            payloadNote={`${Math.round((payload / limit) * 100)}% of ${kg(limit)}`}
            overLabel="Over the payload limit"
          />
        );
      })}
    </CardRail>
  );
}

function ContainerSelectorSpecimen() {
  const [count, setCount] = useState(2);
  const [payload, setPayload] = useState(17100);
  const limit = 28000;
  const kg = (value: number) => `${value.toLocaleString('en-GB')} kg`;
  const percent = Math.round((payload / limit) * 100);
  return (
    <div className={styles.specimenRow}>
      <ContainerSelector
        label="40 ft high cube"
        code="40' HC"
        dimensions="12.03 × 2.35 × 2.69 m"
        capacity="76 m³ · 25 EU pallets"
        count={count}
        onCountChange={setCount}
        countLabel="Containers"
        decrementLabel="One fewer container"
        incrementLabel="One more container"
        payload={payload}
        payloadLimit={limit}
        onPayloadChange={setPayload}
        payloadLabel="Gross each"
        payloadUnit="kg"
        payloadValueText={`${kg(payload)} of ${kg(limit)}`}
        payloadNote={`${percent}% of ${kg(limit)}`}
        overLabel="Over the payload limit"
      />
    </div>
  );
}

/** CH-14 is a filter, so it is only worth looking at while it is filtering. */
function ListingHeroSpecimen() {
  const [segment, setSegment] = useState<string | null>(null);
  const segments = [
    // Two of these sit at zero on purpose: the specimen has to show both the
    // state that filters and the state that only reports.
    { key: 'submitted', label: 'Submitted', count: 2 },
    { key: 'in_progress', label: 'In progress', count: 0 },
    { key: 'options_ready', label: 'Quoted', count: 3 },
    { key: 'expiring_soon', label: 'Quoted · expiring', count: 1 },
    { key: 'accepted', label: 'Accepted', count: 2 },
    { key: 'declined', label: 'Declined', count: 0 },
    { key: 'expired', label: 'Expired', count: 1 },
  ];
  const total = segments.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <ListingHero
      eyebrow="Your quotations · Iberia Retail Group SL"
      title="Quotations"
      subtitle="Every quote, whether you requested it or we prepared it for you. The bar shows what is waiting on you."
      pipelineTitle={`Your pipeline · ${total} quotations`}
      pipelineNote="4 waiting on your decision · pick a segment to filter"
      segments={segments}
      activeSegment={segment}
      onSegmentChange={setSegment}
      segmentsLabel="Filter by state"
      clearLabel="Clear filter"
      segmentTitle={(count, label) => `${count} ${label.toLocaleLowerCase()}`}
      footnote="Quotes are held for the validity shown. After that a new rate has to be confirmed with the carrier."
    >
      <div className="noa-listing">
        <div className="noa-listing-toolbar">
          {segment === null ? 'The whole list' : `Filtered to ${segment.replaceAll('_', ' ')}`}
        </div>
      </div>
    </ListingHero>
  );
}

/** CH-11 needs live state to be worth looking at. */
function PaginationSpecimen() {
  const [page, setPage] = useState(3);
  const [pageSize, setPageSize] = useState(25);
  const pageCount = 12;
  return (
    <Pagination
      navLabel="Pagination"
      label={`Page ${page} of ${pageCount}`}
      rangeLabel={`Showing ${(page - 1) * pageSize + 1}–${page * pageSize} of 287`}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      previousLabel="Previous page"
      nextLabel="Next page"
      lastLabel="Last page"
      pageSize={pageSize}
      pageSizeLabel="Rows per page"
      pageSizeOptions={[10, 25, 50]}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Page                                                                     */
/* ------------------------------------------------------------------------ */

export function Gallery() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return CATALOGUE;
    return CATALOGUE.filter(([code, label, group]) =>
      `${code} ${label} ${group}`.toLowerCase().includes(needle),
    );
  }, [query]);

  // The selection lives in the URL so a specimen can be linked to directly.
  const requested = params.get('c');
  const selected =
    matches.find(([code]) => code === requested) ??
    matches.find(([code]) => SPECIMENS[code]) ??
    matches[0];

  const reviewed = CATALOGUE.filter(([code]) => SPECIMENS[code]).length;

  const select = (code: string) => {
    const next = new URLSearchParams(params);
    next.set('c', code);
    setParams(next, { replace: true });
  };

  return (
    <div className={styles.page}>
      <aside className={styles.rail} aria-label="UI kit catalogue">
        <header className={styles.railHead}>
          <p className={styles.eyebrow}>Noatum design system</p>
          <h1 className={styles.wordmark}>UI kit</h1>
          <p className={styles.progress}>
            <strong>{reviewed}</strong> of {CATALOGUE.length} checked against the mockup
          </p>
          <label className={styles.searchLabel} htmlFor="kit-filter">
            Filter
          </label>
          <input
            id="kit-filter"
            type="search"
            className={styles.search}
            value={query}
            placeholder="Code, name or group"
            onChange={(event) => setQuery(event.target.value)}
          />
        </header>

        <nav className={styles.nav} aria-label="Components">
          {GROUPS.map((group) => {
            const entries = matches.filter(([, , entryGroup]) => entryGroup === group);
            if (!entries.length) return null;
            return (
              <section key={group} className={styles.navGroup}>
                <h2>{group}</h2>
                <ul>
                  {entries.map(([code, label]) => (
                    <li key={code}>
                      <button
                        type="button"
                        className={styles.navItem}
                        aria-current={code === selected?.[0] ? 'true' : undefined}
                        data-state={SPECIMENS[code] ? 'reviewed' : 'pending'}
                        onClick={() => select(code)}
                      >
                        <span className={styles.navCode}>{code}</span>
                        <span className={styles.navLabel}>{label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {!matches.length && <p className={styles.noMatch}>Nothing matches “{query}”.</p>}
        </nav>
      </aside>

      <main className={styles.stage}>
        {selected ? <SpecimenPanel code={selected[0]} label={selected[1]} group={selected[2]} /> : null}
      </main>
    </div>
  );
}

function SpecimenPanel({ code, label, group }: { code: string; label: string; group: Group }) {
  const specimen = SPECIMENS[code];
  return (
    <article className={styles.specimen}>
      <header>
        <p className={styles.eyebrow}>
          {group} · {code}
        </p>
        <h2>{label}</h2>
        <span className={styles.rule} aria-hidden="true" />
        {specimen && <p className={styles.intent}>{specimen.intent}</p>}
      </header>

      {specimen ? (
        <>
          <div className={styles.canvas}>{specimen.render()}</div>
          {specimen.corrected?.length ? (
            <section className={styles.corrections}>
              <h3>What was corrected</h3>
              <ul>
                {specimen.corrected.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <p className={styles.pending}>
          <strong>Not checked yet.</strong> This code is in the mockup catalogue but has not been
          compared against it in code.
        </p>
      )}
    </article>
  );
}

function ComboInputSpecimen() {
  const [commodity, setCommodity] = useState('');
  return (
    <div className={styles.dateGrid}>
      <ComboInput
        label="Commodity"
        options={[
          'Chemicals', 'Paints and coatings', 'Flat-packed furniture', 'Textiles',
          'Machinery parts', 'Ceramic tiles', 'Olive oil', 'España — packaging',
        ]}
        value={commodity}
        hint="Pick one, or describe it in your own words."
        emptyHint="No match. It will be sent as typed and read by a pricing specialist."
        onChange={(event) => setCommodity(event.target.value)}
      />
    </div>
  );
}

/**
 * SP-09 with figures already worked out, the way a caller supplies them.
 *
 * The numbers here are the mockup's own, kept as a fixed table so the specimen
 * demonstrates the panel rather than a calculation — the panel does no
 * arithmetic, which is the point of it.
 */
const CO2_LANES: {
  from: string; to: string; modes: Co2Mode[]; km: Partial<Record<Co2Mode, number>>;
}[] = [
  { from: 'Qingdao', to: 'Valencia', modes: ['Sea FCL', 'Sea LCL', 'Air'], km: { 'Sea FCL': 19800, 'Sea LCL': 19800, Air: 9600 } },
  { from: 'Qingdao', to: 'Rotterdam', modes: ['Sea FCL', 'Sea LCL', 'Air'], km: { 'Sea FCL': 20400, 'Sea LCL': 20400, Air: 8400 } },
  { from: 'Valencia', to: 'Rotterdam', modes: ['Sea FCL', 'Sea LCL', 'Road', 'Rail'], km: { 'Sea FCL': 3100, 'Sea LCL': 3100, Road: 2050, Rail: 2100 } },
  { from: 'Barcelona', to: 'Lyon', modes: ['Road', 'Rail'], km: { Road: 640, Rail: 690 } },
];

/** g CO2e per tonne-kilometre, well to wheel. */
const CO2_INTENSITY: Record<Co2Mode, number> = {
  'Sea FCL': 8, 'Sea LCL': 12, Air: 500, Rail: 22, Road: 62,
};

function Co2CalculatorSpecimen() {
  const [from, setFrom] = useState('Qingdao');
  const [to, setTo] = useState('Valencia');
  const [mode, setMode] = useState<Co2Mode>('Sea FCL');
  const [tonnes, setTonnes] = useState('34');

  const origins = [...new Set(CO2_LANES.map((entry) => entry.from))];
  const reachable = CO2_LANES.filter((entry) => entry.from === from).map((entry) => entry.to);
  const destination = reachable.includes(to) ? to : reachable[0]!;
  const lane = CO2_LANES.find((e) => e.from === from && e.to === destination) ?? CO2_LANES[0]!;
  const served = lane.modes.includes(mode) ? mode : lane.modes[0]!;
  const weight = Math.max(0.1, Number(tonnes) || 0.1);
  const km = (m: Co2Mode) => lane.km[m] ?? 0;
  const kg = (m: Co2Mode) => (weight * km(m) * CO2_INTENSITY[m]) / 1000;
  const round = (n: number) => Math.round(n).toLocaleString('en-GB');

  const peak = Math.max(1, ...lane.modes.map(kg));
  const worst = lane.modes.reduce((a, b) => (kg(a) > kg(b) ? a : b));
  const best = lane.modes.reduce((a, b) => (kg(a) < kg(b) ? a : b));

  return (
    <Co2Calculator
      labels={{
        title: 'CO₂e calculator',
        blurb: 'Compare modes on a lane you are about to quote. Indicative, GLEC-aligned, not a certified emissions statement.',
        origin: 'Origin', destination: 'Destination', mode: 'Mode', weight: 'Chargeable weight', tonnes: 'tonnes',
        basis: 'Sea uses container-ship averages, air uses belly-freight averages, road a 40 t articulated truck and rail electrified intermodal.',
        estimated: `Estimated emissions · ${served}`,
        unit: 'kg CO₂e',
        compare: 'Same cargo, same lane, other modes',
        disclaimer: 'Well-to-wheel estimates from lane distance, mode and default load factors. Actual emissions depend on carrier, vessel or aircraft, routing and utilisation. Not a certified emissions statement.',
        unservedMode: (m) => `${m} does not serve this lane`,
      }}
      origins={origins.map((place) => ({ id: place, label: place }))}
      originId={from}
      onOriginChange={setFrom}
      destinations={reachable.map((place) => ({ id: place, label: place }))}
      destinationId={destination}
      onDestinationChange={setTo}
      modes={['Sea FCL', 'Sea LCL', 'Air', 'Rail', 'Road']}
      servedModes={lane.modes}
      mode={served}
      onModeChange={setMode}
      tonnes={tonnes}
      onTonnesChange={setTonnes}
      presets={[
        { id: 'pallet', label: '1 pallet · 0.8 t', tonnes: 0.8 },
        { id: 'fcl20', label: "20' FCL · 18 t", tonnes: 18 },
        { id: 'hc40x2', label: "2 × 40' HC · 34 t", tonnes: 34 },
      ]}
      total={round(kg(served))}
      detail={`${weight.toLocaleString('en-GB')} t · ${round(km(served))} km · ${from} to ${destination}`}
      facts={[
        { key: 'Distance', value: `${round(km(served))} km`, sub: 'great-circle, mode adjusted' },
        { key: 'Intensity', value: `${CO2_INTENSITY[served]} g`, sub: 'per tonne-km, well to wheel' },
        { key: 'Per tonne', value: `${round(kg(served) / weight)} kg`, sub: 'of chargeable cargo' },
      ]}
      byMode={lane.modes.map((m) => ({ mode: m, label: `${round(kg(m))} kg`, share: kg(m) / peak }))}
      worstMode={worst}
      comparison={
        served === best
          ? `This is the lowest-emission mode on the lane · ${worst} would emit about ${(kg(worst) / Math.max(1, kg(best))).toFixed(1)}× more.`
          : `Switching to ${best} would cut about ${round(kg(served) - kg(best))} kg CO₂e, at a longer transit.`
      }
    />
  );
}
