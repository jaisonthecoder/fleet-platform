import { Injectable, Logger } from '@nestjs/common';

/**
 * The only file that knows about Google.
 *
 * Transport, nothing else: no prompt, no freight vocabulary, no judgement about
 * what came back. Both assistants send their own prompt through here, which is
 * why they can behave completely differently without a second HTTP client.
 *
 * Deliberately plain `fetch` rather than the SDK: no new dependency, no lockfile
 * churn, and the whole folder lifts out when the demo is over.
 */

/** A Gemini content part. Text, or an inlined document the model should read. */
export type ModelPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type ModelStatus = 'ok' | 'not-configured' | 'unreadable';

export interface ModelResult {
  status: ModelStatus;
  /** Parsed JSON when the model returned any, else null. */
  json: unknown;
  /** The raw answer, kept so callers can run keyword checks over it. */
  text: string;
  /** Which model answered, since the client falls back across several. */
  model?: string;
  detail?: string;
}

/** Per model, not for the whole loop: see the comment on the fallback below. */
const TIMEOUT_MS = 12_000;

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);

  private get apiKey(): string | undefined {
    return process.env.AI_ASSISTANT_API_KEY?.trim() || undefined;
  }

  /**
   * Models to try, in order.
   *
   * Google returns 503 on a busy model often enough that depending on one is a
   * coin toss. `AI_ASSISTANT_MODEL` takes a comma-separated list, and the first
   * that answers wins.
   */
  private get models(): string[] {
    const configured = process.env.AI_ASSISTANT_MODEL?.split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    return configured?.length
      ? configured
      : ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash'];
  }

  /** The model named in configuration, for provenance when nothing answered. */
  configuredModel(): string {
    return this.models[0] ?? 'gemini';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Sends the parts and asks for strict JSON back.
   *
   * `label` only reaches the log, so one failing assistant can be told from the
   * other without reading stack traces.
   */
  async json(parts: ModelPart[], label: string): Promise<ModelResult> {
    if (!this.apiKey) {
      return { status: 'not-configured', json: null, text: '' };
    }

    const body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    });

    let lastDetail = 'All models busy';

    // 503 from a busy model is common and transient, so try each model in turn
    // rather than failing on the first one that is under load. The signal is
    // created per attempt: one shared signal means the first timeout aborts
    // every remaining attempt before it is even sent.
    for (const model of this.models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
            body,
          },
        );

        if (response.status === 503 || response.status === 429 || response.status === 404) {
          this.logger.warn(`${label}: model ${model} unavailable (${response.status})`);
          continue;
        }

        if (!response.ok) {
          const detail = await response.text();
          this.logger.warn(`${label}: refused by ${model} (${response.status})`);
          return { status: 'unreadable', json: null, text: '', detail: detail.slice(0, 200) };
        }

        const payload = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };

        const text =
          payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
        const json = parseJson(text);

        if (json === null) {
          this.logger.warn(`${label}: model ${model} returned no JSON`);
          continue;
        }

        return { status: 'ok', json, text, model };
      } catch (error) {
        // A timeout or a dropped connection is the same class of problem as a 503:
        // this model is not answering, so move on to the next one.
        lastDetail = (error as Error).message;
        this.logger.warn(`${label}: failed on ${model}: ${lastDetail}`);
        continue;
      }
    }

    return { status: 'unreadable', json: null, text: '', detail: lastDetail };
  }
}

/** Tolerant of a fenced or prefixed response, because models add both. */
export function parseJson(text: string): unknown {
  const firstObject = text.indexOf('{');
  const firstArray = text.indexOf('[');
  const start =
    firstObject < 0 ? firstArray : firstArray < 0 ? firstObject : Math.min(firstObject, firstArray);
  if (start < 0) return null;

  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** The model returns numbers as strings often enough to be worth handling. */
export function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Trimmed text, or null. Models answer "null" and "" and "N/A" interchangeably. */
export function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || /^(null|n\/a|none|unknown)$/i.test(trimmed)) return null;
  return trimmed;
}
