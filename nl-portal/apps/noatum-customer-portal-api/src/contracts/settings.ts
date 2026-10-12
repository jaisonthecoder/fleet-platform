/**
 * Scoped settings. ADR-010.
 *
 * The third layer, below platform switches and beside customer entitlements.
 * A switch answers "may anyone at Noatum use this at all" and can only answer it
 * once, for everybody. A setting answers "how does THIS part of the business use
 * it", and resolves through four layers:
 *
 *     global  <  region  <  branch  <  customer        most specific wins
 *
 * `feature-switches.ts` already told us this file had to exist: it excludes
 * "anything needing a scope or precedence, which is a setting under D-18".
 *
 * The catalogue is code, the values are data. An administrator sets a value at a
 * layer; nobody invents a key. A stored row whose key is absent here is ignored,
 * so a stale key cannot resurrect a behaviour.
 *
 * A setting changes behaviour and presentation, never schema, and never safety.
 * PROTECTED_CAPABILITIES in `feature-switches.ts` are no more configurable here
 * than they are there.
 */

export const SETTING_SCOPES = ['global', 'region', 'branch', 'customer'] as const;

export type SettingScope = (typeof SETTING_SCOPES)[number];

/**
 * Least to most specific. The resolver walks this in order and the last match
 * wins, so the array order IS the precedence rule - there is no second place
 * expressing it that could disagree.
 */
export const SETTING_SCOPE_PRECEDENCE: readonly SettingScope[] = SETTING_SCOPES;

export const SETTING_GROUPS = [
  'publication',
  'organisation_linking',
  'approval',
  'ownership',
  'pricing_information',
  'customer_presentation',
  'communication',
  'feature_availability',
] as const;

export type SettingGroup = (typeof SETTING_GROUPS)[number];

interface SettingBase {
  group: SettingGroup;
  /** English fallback. The SPA translates by key and falls back to this. */
  label: string;
  description: string;
  /**
   * The platform switch that must be on for this setting to be read at all.
   * Composition, not duplication: the switch says the capability exists, the
   * setting says how this branch uses it.
   */
  requiresSwitch?: string;
}

export interface BooleanSetting extends SettingBase {
  type: 'boolean';
  defaultValue: boolean;
}

export interface NumberSetting extends SettingBase {
  type: 'number';
  defaultValue: number;
  /** Rendered beside the input: "hours", "days", "EUR". */
  unit: string;
  min: number;
  max: number;
}

export interface EnumSetting extends SettingBase {
  type: 'enum';
  defaultValue: string;
  options: readonly { value: string; label: string }[];
}

export type SettingDefinition = BooleanSetting | NumberSetting | EnumSetting;

export const SETTINGS = {
  'quotations.pubMode': {
    group: 'publication',
    type: 'enum',
    label: 'Publication mode',
    description:
      'CW1-confirmed: submit pricing to CargoWise and publish after business confirmation. Direct: publish the completed offer without waiting for CargoWise. Internal approval still applies either way.',
    defaultValue: 'cw1',
    options: [
      { value: 'cw1', label: 'CW1 confirmation required' },
      { value: 'direct', label: 'Direct customer publication' },
    ],
  },
  'quotations.sendReqCw1': {
    group: 'publication',
    type: 'boolean',
    label: 'Send unpriced request to CargoWise',
    description: 'Create the quote request record in CargoWise when the customer submits.',
    defaultValue: true,
  },
  'organisations.fourEyes': {
    group: 'organisation_linking',
    type: 'boolean',
    label: 'Second-person confirmation of links',
    description:
      'On: a different administrator approves every mapping request. Off: the requester confirms with justification, and it is still audited.',
    defaultValue: true,
  },
  'quotations.approval': {
    group: 'approval',
    type: 'boolean',
    label: 'Approval required',
    description:
      'A different authorised approver must approve submissions above the threshold.',
    defaultValue: true,
  },
  'quotations.threshold': {
    group: 'approval',
    type: 'number',
    label: 'Approval threshold',
    description:
      'Evaluated on the highest option sell total, converted to EUR at the daily rate.',
    defaultValue: 10_000,
    unit: 'EUR',
    min: 0,
    max: 100_000_000,
  },
  'quotations.claimExpiry': {
    group: 'ownership',
    type: 'number',
    label: 'Claim expiry',
    description: 'An unsubmitted claim is released automatically after this time.',
    defaultValue: 4,
    unit: 'hours',
    // Below an hour a specialist loses the request while still reading it; above
    // a week the queue silently stops being a queue.
    min: 1,
    max: 168,
  },
  'quotations.releaseBy': {
    group: 'ownership',
    type: 'enum',
    label: "Who can release another user's claim",
    description: 'Force-release is always audited.',
    defaultValue: 'approver',
    options: [
      { value: 'approver', label: 'Pricing approvers' },
      { value: 'admin', label: 'Administrators only' },
    ],
  },
  'quotations.costCapture': {
    group: 'pricing_information',
    type: 'boolean',
    label: 'Cost and margin capture',
    description:
      'Staff can record internal cost per charge line. Never shown to customers; access is permission-controlled separately by quotes.cost.view.',
    // Off. The organisation has no rate or cost store and no standard quoting
    // process (director, 17.09.2026), so recording cost is something a branch
    // opts into, not something the platform assumes.
    defaultValue: false,
  },
  'quotations.disclose': {
    group: 'customer_presentation',
    type: 'boolean',
    label: 'Carrier name disclosure',
    description:
      'Show the carrier on option cards and on the PDF. Otherwise the customer sees "disclosed on booking".',
    defaultValue: false,
  },
  'quotations.validity': {
    group: 'customer_presentation',
    type: 'number',
    label: 'Default quote validity',
    description: 'Pre-filled on each option. Staff can shorten it.',
    defaultValue: 21,
    unit: 'days',
    min: 1,
    max: 365,
  },
  'quotations.draftSvc': {
    group: 'communication',
    type: 'boolean',
    label: 'External drafting service',
    description: 'Pre-draft the customer message. Humans always review and send.',
    defaultValue: true,
    requiresSwitch: 'communication.ai_drafting',
  },
  'quotations.co2': {
    group: 'feature_availability',
    type: 'boolean',
    label: 'CO2 estimate on quotes',
    description:
      'Show estimated kg CO2e per option once the methodology (OQ-20) is approved.',
    defaultValue: false,
  },
} as const satisfies Record<string, SettingDefinition>;

export type SettingKey = keyof typeof SETTINGS;

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

/** The resolved type of a key, so callers are not handed `unknown`. */
export type SettingValueOf<K extends SettingKey> =
  (typeof SETTINGS)[K] extends { type: 'boolean' }
    ? boolean
    : (typeof SETTINGS)[K] extends { type: 'number' }
      ? number
      : string;

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS, key);
}

/**
 * The catalogue entry, widened to the union.
 *
 * `as const satisfies` keeps each entry's literal type, which is what makes
 * `SettingValueOf` work - but it also means optional members exist only on the
 * entries that declare them. Read a definition through here when you need the
 * shape rather than the exact literal.
 */
export function settingDefinition(key: SettingKey): SettingDefinition {
  return SETTINGS[key];
}

/**
 * Validates a candidate value against the catalogue. Returns the coerced value
 * or throws, because a setting stored in the wrong shape fails later, somewhere
 * else, in a way nobody traces back to here.
 */
export function parseSettingValue(key: SettingKey, value: unknown): boolean | number | string {
  const definition: SettingDefinition = SETTINGS[key];

  if (definition.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new Error(`Setting ${key} expects true or false.`);
    }
    return value;
  }

  if (definition.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Setting ${key} expects a number.`);
    }
    if (value < definition.min || value > definition.max) {
      throw new Error(
        `Setting ${key} must be between ${definition.min} and ${definition.max} ${definition.unit}.`,
      );
    }
    return value;
  }

  if (typeof value !== 'string' || !definition.options.some((o) => o.value === value)) {
    const allowed = definition.options.map((o) => o.value).join(', ');
    throw new Error(`Setting ${key} must be one of: ${allowed}.`);
  }

  return value;
}
