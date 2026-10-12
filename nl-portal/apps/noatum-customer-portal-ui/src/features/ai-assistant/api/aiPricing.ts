import { authenticatedClient } from '../../auth/api/current-user';

export interface AssistLine {
  code: string;
  description: string;
  basis: string;
  quantity: string;
  /** Decimal major units as the carrier wrote it. Blank when scaffolded. */
  rate: string;
  currency: string;
  reason: string;
  /** True where the rate is a demonstration figure, not a quoted one. */
  indicative: boolean;
}

export interface AssistOption {
  name: string;
  carrierName: string;
  serviceRouting: string;
  transitDaysMin: string;
  transitDaysMax: string;
  nextDepartures: string;
  freeTimeDays: string;
  validUntil: string;
  currency: string;
  notes: string;
  lines: AssistLine[];
}

export interface AssistQuestion {
  id: string;
  /** Which option the answer belongs to. -1 where it is about the quote. */
  optionIndex: number;
  field: string;
  ask: string;
}

export interface AssistResult {
  status: 'ready' | 'not-configured' | 'unreadable';
  detail?: string;
  provenance: { provider?: string; model?: string; generatedAt?: string; source?: string };
  say: string[];
  derived: { rule: string; text: string }[];
  options: AssistOption[];
  questions: AssistQuestion[];
  /** Whether to rewrite the option on screen or add one. */
  target: 'current' | 'new';
  /** True where the rates are demonstration figures a pricer must replace. */
  indicative: boolean;
  message?: string;
}

export interface AssistDraftOption {
  name?: string;
  carrierName?: string;
  transitDaysMin?: number | null;
  transitDaysMax?: number | null;
  freeTimeDays?: number | null;
  validUntil?: string;
  currency?: string;
  /** Decimal major units, for wording only. The API recomputes nothing from it. */
  total?: number;
}

export interface AssistInput {
  want: 'brief' | 'scaffold' | 'reply' | 'message';
  count?: number;
  /** `current` rewrites the open option; `new` adds one. */
  target?: 'current' | 'new';
  /** How many options the editor already holds, so shapes are not repeated. */
  existing?: number;
  /** Demo only: ask for indicative figures rather than blank rates. */
  fill?: boolean;
  text?: string;
  file?: { mimeType: string; dataBase64: string };
  locale?: string;
  draft?: AssistDraftOption[];
}

/** Demo endpoint. Drafts only: it writes nothing and publishes nothing. */
export async function requestAssist(quoteId: string, input: AssistInput): Promise<AssistResult> {
  const client = await authenticatedClient('staff');

  const response = await client.POST('/api/pricing/quotes/{id}/assist', {
    params: { path: { id: quoteId } },
    body: input,
  });

  if (response.error) {
    throw new Error('assist-failed');
  }

  return response.data as unknown as AssistResult;
}
