/**
 * The Phase 1 lookup catalogue.
 *
 * Every dataset here is either an international standard, a mirror of a code
 * enum, or an extract of a CargoWise workbook committed in `docs/`. Nothing is
 * invented: where a name is not knowable from an authoritative source the code
 * is used as its own label and the gap is left visible in the UI.
 *
 * Country and currency names come from ICU through `Intl.DisplayNames`, so the
 * English and Spanish labels are CLDR's rather than a hand transcription.
 *
 * LM-D01 still owns the final inventory. Datasets absent on purpose:
 *   * quote rejection reasons - still an enum, and LM-D02 must settle the
 *     migration before editable reasons exist.
 *   * UN/LOCODE and charge codes - licensing and source ownership unresolved.
 */
import { readFileSync } from 'node:fs';

export const LOCALES = ['en-US', 'es-ES'];

const displayName = (locale, type, code) => {
  const names = new Intl.DisplayNames([locale], { type, fallback: 'code' });
  return names.of(code);
};

const labelsFor = (type, code) =>
  Object.fromEntries(LOCALES.map((locale) => [locale, displayName(locale, type, code)]));

/** A simple `code: [english, spanish]` map becomes items in listed order. */
const fromPairs = (pairs) =>
  Object.entries(pairs).map(([code, [en, es]]) => ({
    code,
    labels: { 'en-US': en, 'es-ES': es },
  }));

// ---------------------------------------------------------------------------
// Standards
// ---------------------------------------------------------------------------

/**
 * ISO 3166-1 alpha-2. ICU is asked about every two-letter combination and the
 * ones it does not recognise fall out, which yields the assigned list without
 * transcribing 250 codes.
 *
 * Two sets are removed. CLDR extras and exceptional reservations (EU, UN, the
 * Canary Islands and similar) are not countries. ISO 3166-3 withdrawn codes are
 * worse than merely wrong: ICU resolves them to their successor's name, so
 * `SU` arrives labelled "Russia" and `DD` labelled "Germany". Left in, the list
 * would offer two identical labels and let somebody address a shipment to East
 * Germany.
 *
 * XK (Kosovo) is excluded as user-assigned rather than ISO 3166-1. If a real
 * destination needs it, that is an LM-D01 decision, not a silent addition.
 */
function countryItems() {
  const cldrExtras = ['AC', 'CP', 'DG', 'EA', 'EU', 'EZ', 'IC', 'QO', 'TA', 'UK', 'UN', 'XA', 'XB', 'XK', 'ZZ'];
  const withdrawn = [
    'AN', 'BU', 'CS', 'CT', 'DD', 'DY', 'FQ', 'FX', 'HV', 'JT', 'MI', 'NH',
    'NQ', 'NT', 'PC', 'PU', 'PZ', 'RH', 'SU', 'TP', 'VD', 'WK', 'YD', 'YU', 'ZR',
  ];
  const notCountries = new Set([...cldrExtras, ...withdrawn]);
  const alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  const items = [];

  for (const first of alphabet) {
    for (const second of alphabet) {
      const code = first + second;
      if (notCountries.has(code)) continue;
      const english = displayName('en-US', 'region', code);
      if (english === code) continue; // ICU echoes the code when it knows nothing.
      items.push({ code, labels: labelsFor('region', code) });
    }
  }
  return items.sort((a, b) => a.labels['en-US'].localeCompare(b.labels['en-US'], 'en'));
}

/** ISO 4217, as ICU knows it. */
function currencyItems() {
  return Intl.supportedValuesOf('currency')
    .map((code) => ({ code, labels: labelsFor('currency', code) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Incoterms 2020. The two groups are part of the rules themselves - seven terms
 * work for any mode, four only for sea and inland waterway - so they are modelled
 * as the parent rather than written into each label.
 */
const INCOTERM_GROUPS = fromPairs({
  ANY: ['Any mode of transport', 'Cualquier modo de transporte'],
  SEA: ['Sea and inland waterway transport', 'Transporte marítimo y por vías navegables interiores'],
});

const INCOTERMS = [
  { code: 'EXW', parent: 'ANY', labels: { 'en-US': 'Ex Works', 'es-ES': 'En fábrica' } },
  { code: 'FCA', parent: 'ANY', labels: { 'en-US': 'Free Carrier', 'es-ES': 'Franco porteador' } },
  { code: 'CPT', parent: 'ANY', labels: { 'en-US': 'Carriage Paid To', 'es-ES': 'Transporte pagado hasta' } },
  { code: 'CIP', parent: 'ANY', labels: { 'en-US': 'Carriage and Insurance Paid To', 'es-ES': 'Transporte y seguro pagados hasta' } },
  { code: 'DAP', parent: 'ANY', labels: { 'en-US': 'Delivered at Place', 'es-ES': 'Entregada en lugar' } },
  { code: 'DPU', parent: 'ANY', labels: { 'en-US': 'Delivered at Place Unloaded', 'es-ES': 'Entregada en lugar descargada' } },
  { code: 'DDP', parent: 'ANY', labels: { 'en-US': 'Delivered Duty Paid', 'es-ES': 'Entregada derechos pagados' } },
  { code: 'FAS', parent: 'SEA', labels: { 'en-US': 'Free Alongside Ship', 'es-ES': 'Franco al costado del buque' } },
  { code: 'FOB', parent: 'SEA', labels: { 'en-US': 'Free on Board', 'es-ES': 'Franco a bordo' } },
  { code: 'CFR', parent: 'SEA', labels: { 'en-US': 'Cost and Freight', 'es-ES': 'Coste y flete' } },
  { code: 'CIF', parent: 'SEA', labels: { 'en-US': 'Cost, Insurance and Freight', 'es-ES': 'Coste, seguro y flete' } },
];

/**
 * UN/ECE Recommendation 21 package codes, limited to the ones in everyday
 * forwarding use. The full recommendation runs to several hundred; adding the
 * rest is an LM-D01 decision, not a guess.
 */
const PACKAGE_TYPES = fromPairs({
  BG: ['Bag', 'Saco'],
  BL: ['Bale', 'Bala'],
  BX: ['Box', 'Caja'],
  CT: ['Carton', 'Cartón'],
  CS: ['Case', 'Cajón'],
  CI: ['Can, cylindrical', 'Lata cilíndrica'],
  CR: ['Crate', 'Jaula'],
  DR: ['Drum', 'Bidón'],
  PK: ['Package', 'Bulto'],
  PX: ['Pallet', 'Palé'],
  RL: ['Reel', 'Bobina'],
  RO: ['Roll', 'Rollo'],
  TU: ['Tube', 'Tubo'],
  VL: ['Bulk, liquid', 'Granel líquido'],
  VR: ['Bulk, solid, granular', 'Granel sólido granulado'],
});

/** Industry size-type shorthand built on ISO 6346. */
const CONTAINER_TYPES = fromPairs({
  '20GP': ['20ft general purpose', 'Contenedor estándar de 20 pies'],
  '40GP': ['40ft general purpose', 'Contenedor estándar de 40 pies'],
  '40HC': ['40ft high cube', 'Contenedor high cube de 40 pies'],
  '45HC': ['45ft high cube', 'Contenedor high cube de 45 pies'],
  '20RF': ['20ft reefer', 'Contenedor refrigerado de 20 pies'],
  '40RF': ['40ft reefer', 'Contenedor refrigerado de 40 pies'],
  '40RH': ['40ft reefer high cube', 'Contenedor refrigerado high cube de 40 pies'],
  '20OT': ['20ft open top', 'Contenedor open top de 20 pies'],
  '40OT': ['40ft open top', 'Contenedor open top de 40 pies'],
  '20FR': ['20ft flat rack', 'Contenedor flat rack de 20 pies'],
  '40FR': ['40ft flat rack', 'Contenedor flat rack de 40 pies'],
  '20TK': ['20ft tank', 'Contenedor cisterna de 20 pies'],
});

/** UN/ECE Recommendation 20 unit codes. */
const WEIGHT_UNITS = fromPairs({
  KGM: ['Kilogram', 'Kilogramo'],
  LBR: ['Pound', 'Libra'],
  TNE: ['Tonne (metric)', 'Tonelada métrica'],
});

const VOLUME_UNITS = fromPairs({
  MTQ: ['Cubic metre', 'Metro cúbico'],
  FTQ: ['Cubic foot', 'Pie cúbico'],
  LTR: ['Litre', 'Litro'],
});

const DIMENSION_UNITS = fromPairs({
  MMT: ['Millimetre', 'Milímetro'],
  CMT: ['Centimetre', 'Centímetro'],
  MTR: ['Metre', 'Metro'],
  INH: ['Inch', 'Pulgada'],
  FOT: ['Foot', 'Pie'],
});

const LOAD_TYPES = fromPairs({
  FCL: ['Full container load', 'Contenedor completo'],
  LCL: ['Less than container load', 'Grupaje marítimo'],
  FTL: ['Full truck load', 'Camión completo'],
  LTL: ['Less than truck load', 'Grupaje terrestre'],
});

/**
 * UN dangerous goods classes and their divisions, as used by IMDG and ADR. The
 * divisions are children of their class, which is how the regulation reads.
 */
const HAZARD_CLASSES = [
  { code: '1', labels: { 'en-US': 'Class 1 - Explosives', 'es-ES': 'Clase 1 - Explosivos' } },
  { code: '1.1', parent: '1', labels: { 'en-US': 'Mass explosion hazard', 'es-ES': 'Riesgo de explosión en masa' } },
  { code: '1.2', parent: '1', labels: { 'en-US': 'Projection hazard', 'es-ES': 'Riesgo de proyección' } },
  { code: '1.3', parent: '1', labels: { 'en-US': 'Fire and minor blast hazard', 'es-ES': 'Riesgo de incendio y explosión menor' } },
  { code: '1.4', parent: '1', labels: { 'en-US': 'No significant hazard', 'es-ES': 'Sin riesgo significativo' } },
  { code: '1.5', parent: '1', labels: { 'en-US': 'Very insensitive, mass explosion hazard', 'es-ES': 'Muy insensible, riesgo de explosión en masa' } },
  { code: '1.6', parent: '1', labels: { 'en-US': 'Extremely insensitive, no mass explosion hazard', 'es-ES': 'Extremadamente insensible, sin riesgo de explosión en masa' } },
  { code: '2', labels: { 'en-US': 'Class 2 - Gases', 'es-ES': 'Clase 2 - Gases' } },
  { code: '2.1', parent: '2', labels: { 'en-US': 'Flammable gases', 'es-ES': 'Gases inflamables' } },
  { code: '2.2', parent: '2', labels: { 'en-US': 'Non-flammable, non-toxic gases', 'es-ES': 'Gases no inflamables y no tóxicos' } },
  { code: '2.3', parent: '2', labels: { 'en-US': 'Toxic gases', 'es-ES': 'Gases tóxicos' } },
  { code: '3', labels: { 'en-US': 'Class 3 - Flammable liquids', 'es-ES': 'Clase 3 - Líquidos inflamables' } },
  { code: '4', labels: { 'en-US': 'Class 4 - Flammable solids', 'es-ES': 'Clase 4 - Sólidos inflamables' } },
  { code: '4.1', parent: '4', labels: { 'en-US': 'Flammable solids', 'es-ES': 'Sólidos inflamables' } },
  { code: '4.2', parent: '4', labels: { 'en-US': 'Substances liable to spontaneous combustion', 'es-ES': 'Sustancias que pueden experimentar combustión espontánea' } },
  { code: '4.3', parent: '4', labels: { 'en-US': 'Substances which emit flammable gases in contact with water', 'es-ES': 'Sustancias que desprenden gases inflamables en contacto con el agua' } },
  { code: '5', labels: { 'en-US': 'Class 5 - Oxidising substances', 'es-ES': 'Clase 5 - Sustancias comburentes' } },
  { code: '5.1', parent: '5', labels: { 'en-US': 'Oxidising substances', 'es-ES': 'Sustancias comburentes' } },
  { code: '5.2', parent: '5', labels: { 'en-US': 'Organic peroxides', 'es-ES': 'Peróxidos orgánicos' } },
  { code: '6', labels: { 'en-US': 'Class 6 - Toxic and infectious substances', 'es-ES': 'Clase 6 - Sustancias tóxicas e infecciosas' } },
  { code: '6.1', parent: '6', labels: { 'en-US': 'Toxic substances', 'es-ES': 'Sustancias tóxicas' } },
  { code: '6.2', parent: '6', labels: { 'en-US': 'Infectious substances', 'es-ES': 'Sustancias infecciosas' } },
  { code: '7', labels: { 'en-US': 'Class 7 - Radioactive material', 'es-ES': 'Clase 7 - Material radiactivo' } },
  { code: '8', labels: { 'en-US': 'Class 8 - Corrosive substances', 'es-ES': 'Clase 8 - Sustancias corrosivas' } },
  { code: '9', labels: { 'en-US': 'Class 9 - Miscellaneous dangerous goods', 'es-ES': 'Clase 9 - Mercancías peligrosas diversas' } },
];

const CONTENT_LOCALES = fromPairs({
  'en-US': ['English (United States)', 'Inglés (Estados Unidos)'],
  'es-ES': ['Spanish (Spain)', 'Español (España)'],
});

// ---------------------------------------------------------------------------
// Mirrors of code-level contracts
// ---------------------------------------------------------------------------

/** schema.prisma `TransportMode`. Shown so an administrator can see the set; never edited here. */
const TRANSPORT_MODES = fromPairs({
  air: ['Air', 'Aéreo'],
  sea: ['Sea', 'Marítimo'],
  road: ['Road', 'Carretera'],
  rail: ['Rail', 'Ferrocarril'],
});

/** schema.prisma `QuoteStatus`. The transitions live in code, not in this table. */
const QUOTE_STATUSES = fromPairs({
  draft: ['Draft', 'Borrador'],
  rated: ['Rated', 'Tarificada'],
  rate_failed: ['Rate failed', 'Tarificación fallida'],
  expired: ['Expired', 'Caducada'],
  accepted: ['Accepted', 'Aceptada'],
  rejected: ['Rejected', 'Rechazada'],
});

// ---------------------------------------------------------------------------
// CargoWise extracts
// ---------------------------------------------------------------------------

const readExtract = (file) =>
  JSON.parse(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'));

/**
 * Builds the CargoWise datasets from the committed extracts.
 *
 * Both arrive customer-invisible. For documents that is the allow-list rule
 * working as intended - 479 manually typed CargoWise document types are exactly
 * the unreviewed set that must never reach a customer by default. Events use an
 * exclude-list, but the exclusions have not been agreed, so they stay internal
 * until that Phase 2 decision lands rather than defaulting to visible.
 */
function cargowiseDatasets() {
  const documents = readExtract('cw1-document-types.json');
  const events = readExtract('cw1-event-codes.json');

  return [
    {
      code: 'cw1_document_category',
      name: 'CargoWise document categories',
      description: 'Module groupings the source applies to document types. Category names are not published by the source, so each shows its code.',
      ownership: 'source',
      sourceSystem: 'cw1',
      sourceRef: `${documents.source} @ ${documents.sha256.slice(0, 12)}`,
      customerVisible: false,
      items: documents.categories.map((code) => ({
        code,
        sourceRef: code,
        labels: Object.fromEntries(LOCALES.map((locale) => [locale, code])),
      })),
    },
    {
      code: 'cw1_document_type',
      name: 'CargoWise document types',
      description: 'Every document type defined in the source. None is customer visible until it is explicitly approved.',
      ownership: 'source',
      sourceSystem: 'cw1',
      sourceRef: `${documents.source} @ ${documents.sha256.slice(0, 12)}`,
      parentCategory: 'cw1_document_category',
      customerVisible: false,
      items: documents.items.map((item) => ({
        code: item.code,
        parent: item.category || null,
        sourceRef: item.code,
        isActive: item.isActive,
        labels: Object.fromEntries(LOCALES.map((locale) => [locale, item.name])),
      })),
    },
    {
      code: 'cw1_event_code',
      name: 'CargoWise event codes',
      description: 'Every milestone event code defined in the source. The customer exclude-list is a Phase 2 decision, so none is exposed yet.',
      ownership: 'source',
      sourceSystem: 'cw1',
      sourceRef: `${events.source} @ ${events.sha256.slice(0, 12)}`,
      customerVisible: false,
      items: events.items.map((item) => ({
        code: item.code,
        sourceRef: item.code,
        isActive: item.isActive,
        labels: Object.fromEntries(LOCALES.map((locale) => [locale, item.name])),
      })),
    },
    {
      code: 'cw1_address_type',
      name: 'CargoWise address types',
      description:
        'What each organisation address is used for. The authoritative list belongs to CargoWise and is still awaited (gap N11); these are the codes the simulator issues, labelled so the directory is readable. An unknown code is shown as its code, never guessed.',
      ownership: 'source',
      sourceSystem: 'cw1',
      sourceRef: 'awaiting the CargoWise list',
      customerVisible: false,
      items: [
        { code: 'OFC', en: 'Office', es: 'Oficina' },
        { code: 'HDO', en: 'Head office', es: 'Sede central' },
        { code: 'BIL', en: 'Billing', es: 'Facturación' },
        { code: 'WHS', en: 'Warehouse', es: 'Almacén' },
        { code: 'PKP', en: 'Pickup', es: 'Recogida' },
        { code: 'DLV', en: 'Delivery', es: 'Entrega' },
      ].map((entry) => ({
        code: entry.code,
        sourceRef: entry.code,
        labels: { 'en-US': entry.en, 'es-ES': entry.es },
      })),
    },
  ];
}

// ---------------------------------------------------------------------------

export function catalogue() {
  const datasets = [
    {
      code: 'country',
      name: 'Countries and territories',
      description: 'ISO 3166-1 alpha-2. Used for addresses, routing and customs.',
      ownership: 'portal',
      sourceRef: 'ISO 3166-1 alpha-2; names from ICU/CLDR',
      customerVisible: true,
      items: countryItems(),
    },
    {
      code: 'currency',
      name: 'Currencies',
      description: 'ISO 4217. Quotes and invoices always show the code with the amount.',
      ownership: 'portal',
      sourceRef: 'ISO 4217; names from ICU/CLDR',
      customerVisible: true,
      items: currencyItems(),
    },
    {
      code: 'incoterm_group',
      name: 'Incoterms groups',
      description: 'The two families of Incoterms 2020 rules.',
      ownership: 'portal',
      sourceRef: 'ICC Incoterms 2020',
      customerVisible: true,
      items: INCOTERM_GROUPS,
    },
    {
      code: 'incoterm',
      name: 'Incoterms',
      description: 'Incoterms 2020 rules, grouped by the transport they apply to.',
      ownership: 'portal',
      sourceRef: 'ICC Incoterms 2020',
      parentCategory: 'incoterm_group',
      customerVisible: true,
      items: INCOTERMS,
    },
    {
      code: 'package_type',
      name: 'Package types',
      description: 'Outer packaging for a cargo line. Common UN/ECE Recommendation 21 codes.',
      ownership: 'portal',
      sourceRef: 'UN/ECE Recommendation 21 (subset)',
      customerVisible: true,
      items: PACKAGE_TYPES,
    },
    {
      code: 'container_type',
      name: 'Container types',
      description: 'Size and type shorthand for sea equipment.',
      ownership: 'portal',
      sourceRef: 'ISO 6346 size-type usage',
      customerVisible: true,
      items: CONTAINER_TYPES,
    },
    {
      code: 'load_type',
      name: 'Load types',
      description: 'Whether a shipment fills its equipment or is consolidated.',
      ownership: 'portal',
      sourceRef: 'Forwarding practice',
      customerVisible: true,
      items: LOAD_TYPES,
    },
    {
      code: 'weight_unit',
      name: 'Weight units',
      description: 'UN/ECE Recommendation 20 codes. Chargeable weight is always calculated server side.',
      ownership: 'portal',
      sourceRef: 'UN/ECE Recommendation 20',
      customerVisible: true,
      items: WEIGHT_UNITS,
    },
    {
      code: 'volume_unit',
      name: 'Volume units',
      description: 'UN/ECE Recommendation 20 codes.',
      ownership: 'portal',
      sourceRef: 'UN/ECE Recommendation 20',
      customerVisible: true,
      items: VOLUME_UNITS,
    },
    {
      code: 'dimension_unit',
      name: 'Dimension units',
      description: 'UN/ECE Recommendation 20 codes for package dimensions.',
      ownership: 'portal',
      sourceRef: 'UN/ECE Recommendation 20',
      customerVisible: true,
      items: DIMENSION_UNITS,
    },
    {
      code: 'hazard_class',
      name: 'Dangerous goods classes',
      description: 'UN classes and divisions as used by IMDG and ADR. Divisions sit under their class.',
      ownership: 'portal',
      sourceRef: 'UN Model Regulations; IMDG and ADR',
      parentCategory: 'hazard_class',
      customerVisible: true,
      items: HAZARD_CLASSES,
    },
    {
      code: 'content_locale',
      name: 'Content locales',
      description: 'Languages lookup content can be maintained in.',
      ownership: 'portal',
      sourceRef: 'BCP 47',
      customerVisible: true,
      items: CONTENT_LOCALES,
    },
    {
      code: 'transport_mode',
      name: 'Transport modes',
      description: 'Mirrors the TransportMode enum. Adding a mode is a code change, not a lookup edit.',
      ownership: 'system',
      sourceRef: 'schema.prisma enum TransportMode',
      customerVisible: true,
      items: TRANSPORT_MODES,
    },
    {
      code: 'quote_status',
      name: 'Quote statuses',
      description: 'Mirrors the QuoteStatus enum. The allowed transitions live in the status machine.',
      ownership: 'system',
      sourceRef: 'schema.prisma enum QuoteStatus',
      customerVisible: true,
      items: QUOTE_STATUSES,
    },
    ...cargowiseDatasets(),
  ];

  /**
   * Rail order: the lists staff maintain first, then the enum mirrors, then the
   * imported catalogues. Alphabetical order put 479 read-only CargoWise
   * document types at the top, which made the screen look broken on arrival.
   */
  const band = { portal: 100, system: 500, source: 900 };
  return datasets.map((set, index) => ({ ...set, sortOrder: band[set.ownership] + index }));
}
