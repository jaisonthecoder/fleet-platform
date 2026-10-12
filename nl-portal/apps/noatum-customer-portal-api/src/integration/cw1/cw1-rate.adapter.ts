import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  RateEngineAdapter,
  type RateRequest,
  type RateResult,
} from '../../contracts/adapters/rate-engine.adapter';
import { MappingService } from '../mapping/mapping.service';

import { Cw1Client } from './cw1.client';
import { XmlCodec } from './xml.codec';

/**
 * CW1-backed rating. Points at the real eAdapter in production and at
 * apps/cw1-simulator locally, decided purely by CW1_RATE_URL.
 */
@Injectable()
export class Cw1RateAdapter extends RateEngineAdapter {
  constructor(
    private readonly client: Cw1Client,
    private readonly config: ConfigService,
    private readonly xml: XmlCodec,
    private readonly mapping: MappingService,
  ) {
    super();
  }

  /** A URL is configuration, not a working rate source: no source is configured
   * anywhere, so this is false unless somebody deliberately points it at one. */
  isConfigured(): boolean {
    return Boolean(this.config.get<string>('cw1.rateUrl'));
  }

  async rate(request: RateRequest): Promise<RateResult> {    const url = this.config.getOrThrow<string>('cw1.rateUrl');

    const body = this.xml.build('RateRequest', {
      TransportMode: await this.mapping.toCw1('transport_mode', request.mode),
      OrganizationCode: request.cw1OrgCode,
      Origin: { UNLOCODE: request.originCode },
      Destination: { UNLOCODE: request.destinationCode },
      GrossWeight: { '@unit': 'KG', '#text': request.grossWeightKg.toFixed(3) },
      ChargeableWeight: { '@unit': 'KG', '#text': request.chargeableKg.toFixed(3) },
      ...(request.volumeM3 ? { Volume: { '@unit': 'M3', '#text': request.volumeM3.toFixed(3) } } : {}),
      Currency: request.currency,
    });

    // Rating is user-facing and synchronous: no retries, fail fast, let the caller mark
    // the quote rate_failed so the user can retry deliberately.
    const raw = await this.client.exchange<Cw1RateResponse>(url, body);
    return this.toResult(raw, request.currency);
  }

  private toResult(raw: Cw1RateResponse, fallbackCurrency: string): RateResult {
    const response = raw.RateResponse ?? {};
    const currency = response.Currency ?? fallbackCurrency;
    const charges = asArray(response.Charges?.Charge);

    const lines = charges.map((charge) => ({
      code: charge.ChargeCode ?? 'UNKNOWN',
      description: charge.Description ?? '',
      // Money crosses the boundary as a decimal string and becomes minor units here.
      // It is never a float at any point.
      amountMinorUnits: toMinorUnits(charge.Amount ?? '0'),
      currency: charge.Currency ?? currency,
    }));

    return {
      lines,
      totalMinorUnits: lines.reduce((sum, line) => sum + line.amountMinorUnits, 0n),
      currency,
      validUntil: response.ValidUntil ? new Date(response.ValidUntil) : defaultValidity(),
      raw,
    };
  }
}

/** Two-decimal minor units without ever constructing a float. */
function toMinorUnits(decimal: string): bigint {
  const [whole = '0', fraction = ''] = decimal.trim().split('.');
  const cents = `${fraction}00`.slice(0, 2);
  const negative = whole.startsWith('-');
  const magnitude = BigInt(`${whole.replace('-', '') || '0'}${cents}`);
  return negative ? -magnitude : magnitude;
}

function defaultValidity(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

interface Cw1RateResponse {
  RateResponse?: {
    Currency?: string;
    ValidUntil?: string;
    Charges?: {
      Charge?:
        | { ChargeCode?: string; Description?: string; Amount?: string; Currency?: string }
        | { ChargeCode?: string; Description?: string; Amount?: string; Currency?: string }[];
    };
  };
}
