import { Injectable } from '@nestjs/common';

import { GeminiClient, type ModelPart } from './shared/gemini.client';

/**
 * What the intake assistant asks the model for, and the shape it must answer in.
 *
 * The connection to Google lives in `shared/gemini.client`; this file owns only
 * the prompt and the facts, which is what makes it the customer side's and not
 * the pricing side's.
 *
 * No key means `isConfigured()` is false and callers report that honestly instead
 * of showing a spinner that never resolves.
 */

export interface IntakeSource {
  /** Pasted email or a typed sentence. */
  text?: string;
  /** An uploaded document, already base64 encoded by the caller. */
  file?: { mimeType: string; dataBase64: string };
}

/** What the model is asked to report. Facts only; no rules, no judgement. */
export interface ObservedFacts {
  mode: string | null;
  originText: string | null;
  destinationText: string | null;
  originCode: string | null;
  destinationCode: string | null;
  incoterm: string | null;
  namedPlace: string | null;
  commodity: string | null;
  hsCode: string | null;
  grossWeightKg: number | null;
  volumeM3: number | null;
  packageCount: number | null;
  packageType: string | null;
  containerType: string | null;
  shipper: string | null;
  consignee: string | null;
  cargoValue: number | null;
  cargoValueCurrency: string | null;
  customerReference: string | null;
  unNumber: string | null;
  hazardClass: string | null;
  properShippingName: string | null;
  packingGroup: string | null;
  technicalName: string | null;
  flashpointCelsius: number | null;
  dgPackagingType: string | null;
  dgPackageCount: number | null;
  netQuantityPerPackage: number | null;
  quantityUnit: string | null;
  temperatureSetPointCelsius: number | null;
  readyDate: string | null;
  notes: string | null;
}

export type ExtractionStatus = 'extracted' | 'not-configured' | 'unreadable';

export interface ExtractionResult {
  status: ExtractionStatus;
  facts: ObservedFacts | null;
  /** Everything the model read, so the rules can run keyword checks over it. */
  rawText: string;
  /** Which model answered, since the client falls back across several. */
  model?: string;
  detail?: string;
}

const EMPTY_FACTS: ObservedFacts = {
  mode: null,
  originText: null, destinationText: null, originCode: null, destinationCode: null,
  incoterm: null, namedPlace: null, commodity: null, hsCode: null,
  grossWeightKg: null, volumeM3: null, packageCount: null, packageType: null,
  containerType: null, shipper: null, consignee: null, cargoValue: null,
  cargoValueCurrency: null, customerReference: null, unNumber: null, hazardClass: null,
  properShippingName: null, packingGroup: null, technicalName: null, flashpointCelsius: null,
  dgPackagingType: null, dgPackageCount: null, netQuantityPerPackage: null, quantityUnit: null,
  temperatureSetPointCelsius: null, readyDate: null, notes: null,
};

const PROMPT = `You read freight documents and enquiry emails for a freight forwarder.

Report ONLY what the document actually says. Return strict JSON matching this shape,
using null for anything not stated. Do not guess, do not calculate, do not advise.

{
  "mode": "air if it is an air waybill or the enquiry says air, sea if it is a bill of lading or mentions containers or vessels, road if it is a truck movement, else null",
  "originText": "place of loading as written, or null",
  "destinationText": "place of discharge as written, or null",
  "originCode": "UN/LOCODE only if the document states one, else null",
  "destinationCode": "UN/LOCODE only if the document states one, else null",
  "incoterm": "three letter Incoterm if stated, else null",
  "namedPlace": "the place named beside the Incoterm, else null",
  "commodity": "short description of the goods",
  "hsCode": "HS code if stated",
  "grossWeightKg": number or null,
  "volumeM3": number or null,
  "packageCount": number or null,
  "packageType": "pallets, cartons, crates, etc",
  "containerType": "container type if the document asks for one, e.g. 20ft, 40HC",
  "shipper": "shipper or exporter name",
  "consignee": "consignee or importer name",
  "cargoValue": number or null,
  "cargoValueCurrency": "ISO currency code",
  "customerReference": "invoice or PO number",
  "unNumber": "UN number if stated, digits only",
  "hazardClass": "hazard class if stated, e.g. 3 or 9",
  "properShippingName": "proper shipping name exactly as written on the dangerous goods declaration, else null",
  "packingGroup": "I, II or III if stated, else null",
  "technicalName": "technical name in brackets after a N.O.S. shipping name, else null",
  "flashpointCelsius": number or null,
  "dgPackagingType": "packaging described for the dangerous goods, e.g. drums, jerricans, boxes",
  "dgPackageCount": number or null,
  "netQuantityPerPackage": number or null,
  "quantityUnit": "unit for the net quantity, e.g. L or KG",
  "temperatureSetPointCelsius": number or null,
  "readyDate": "ISO date ONLY if the document states a cargo ready or shipment date. An invoice date is NOT a ready date; return null.",
  "notes": "any handling instruction worth passing to the pricing team"
}

Rules you must follow:
- Sum weights and volumes across line items into the totals.
- Never put a price or freight cost anywhere. cargoValue is the declared goods value only.
- Never infer a UN number, hazard class, packing group or shipping name from a product
  name. Only report ones that are written. A misdeclaration is worse than a null.
- Return the JSON object alone, with no commentary and no code fence.`;

@Injectable()
export class GeminiIntakeClient {
  constructor(private readonly gemini: GeminiClient) {}

  isConfigured(): boolean {
    return this.gemini.isConfigured();
  }

  async extract(source: IntakeSource): Promise<ExtractionResult> {
    const parts: ModelPart[] = [{ text: PROMPT }];

    if (source.file) {
      parts.push({
        inline_data: { mime_type: source.file.mimeType, data: source.file.dataBase64 },
      });
    }

    if (source.text) {
      parts.push({ text: `Document or enquiry text:\n${source.text}` });
    }

    const result = await this.gemini.json(parts, 'Intake extraction');

    if (result.status !== 'ok' || result.json === null) {
      return {
        status: result.status === 'not-configured' ? 'not-configured' : 'unreadable',
        facts: null,
        rawText: '',
        detail: result.detail,
      };
    }

    const facts = { ...EMPTY_FACTS, ...coerce(result.json as Partial<ObservedFacts>) };

    return {
      status: 'extracted',
      facts,
      rawText: `${result.text}\n${source.text ?? ''}`,
      model: result.model,
    };
  }
}

/** The model returns numbers as strings often enough to be worth handling. */
function coerce(raw: Partial<ObservedFacts>): Partial<ObservedFacts> {
  const numeric: (keyof ObservedFacts)[] = [
    'grossWeightKg', 'volumeM3', 'packageCount', 'cargoValue', 'temperatureSetPointCelsius',
  ];

  const out: Record<string, unknown> = { ...raw };
  for (const key of numeric) {
    const value = out[key];
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^0-9.-]/g, ''));
      out[key] = Number.isFinite(parsed) ? parsed : null;
    }
  }

  return out as Partial<ObservedFacts>;
}
