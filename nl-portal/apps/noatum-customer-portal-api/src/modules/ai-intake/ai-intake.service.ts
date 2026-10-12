import { Injectable } from '@nestjs/common';

import { ReferenceService } from '../reference/reference.service';

import { GeminiIntakeClient, type IntakeSource } from './gemini-intake.client';
import {
  detectHazard,
  detectMode,
  detectTemperature,
  missingEssentials,
  proposeEquipment,
  proposeScope,
  type ContainerOption,
  type IntakeQuestion,
} from './intake-rules';

export interface IntakeDraft {
  status: 'extracted' | 'not-configured' | 'unreadable';
  detail?: string;
  provenance: { source: 'ai'; provider: string; model: string; extractedAt: string };
  fields: Record<string, unknown>;
  derived: { rule: string; text: string }[];
  questions: IntakeQuestion[];
}

@Injectable()
export class AiIntakeService {
  constructor(
    private readonly gemini: GeminiIntakeClient,
    private readonly reference: ReferenceService,
  ) {}

  isConfigured(): boolean {
    return this.gemini.isConfigured();
  }

  async draft(source: IntakeSource, locale?: string): Promise<IntakeDraft> {
    const extraction = await this.gemini.extract(source);
    const provenance = {
      source: 'ai' as const,
      provider: 'google-gemini',
      model: extraction.model ?? process.env.AI_ASSISTANT_MODEL?.split(',')[0]?.trim() ?? 'gemini',
      extractedAt: new Date().toISOString(),
    };

    if (extraction.status !== 'extracted' || !extraction.facts) {
      return {
        status: extraction.status,
        detail: extraction.detail,
        provenance,
        fields: {},
        derived: [],
        questions: [],
      };
    }

    const facts = extraction.facts;
    const freeText = `${extraction.rawText} ${facts.commodity ?? ''} ${facts.notes ?? ''}`;

    // Containers and hazard classes come from the lookups, so a code the model
    // invents cannot reach the form.
    const [containerItems, hazardItems, incotermItems] = await Promise.all([
      this.reference.items('container_type', { locale }),
      this.reference.items('hazard_class', { locale }),
      this.reference.items('incoterm', { locale }),
    ]);

    const containers: ContainerOption[] = containerItems.map((item) => {
      const meta = (item.metadata ?? {}) as Record<string, number | string | undefined>;
      return {
        code: item.code,
        label: item.label,
        capacityM3: typeof meta.capacityM3 === 'number' ? meta.capacityM3 : undefined,
        maxPayloadKg: typeof meta.maxPayloadKg === 'number' ? meta.maxPayloadKg : undefined,
        group: typeof meta.group === 'string' ? meta.group : undefined,
      };
    });

    const hazard = detectHazard(
      freeText,
      {
        unNumber: facts.unNumber,
        hazardClass: facts.hazardClass,
        properShippingName: facts.properShippingName,
        packingGroup: facts.packingGroup,
        technicalName: facts.technicalName,
        flashpointCelsius: facts.flashpointCelsius,
        packagingType: facts.dgPackagingType,
        packageCount: facts.dgPackageCount,
        netQuantityPerPackage: facts.netQuantityPerPackage,
        quantityUnit: facts.quantityUnit,
      },
      hazardItems.map((item) => item.code),
    );

    const temperature = detectTemperature(freeText, facts.temperatureSetPointCelsius);

    const equipment = proposeEquipment({
      volumeM3: facts.volumeM3,
      grossWeightKg: facts.grossWeightKg,
      containers,
      statedContainerCode: matchContainer(facts.containerType, containers),
      reefer: temperature.temperature,
    });

    const incoterm = incotermItems.some((item) => item.code === facts.incoterm?.toUpperCase())
      ? facts.incoterm!.toUpperCase()
      : null;

    const scope = proposeScope(incoterm, false, false);

    const derived = [
      ...equipment.equipment.map((e) => ({ rule: 'equipment', text: e.rule })),
      ...(scope.rule ? [{ rule: 'scope', text: scope.rule }] : []),
    ];

    const fields: Record<string, unknown> = {
      mode: detectMode(freeText, facts.mode),
      loadType: equipment.loadType,
      originCode: facts.originCode,
      destinationCode: facts.destinationCode,
      originText: facts.originText,
      destinationText: facts.destinationText,
      incoterm,
      namedPlace: facts.namedPlace,
      scope: scope.scope,
      commodity: facts.commodity,
      hsCode: facts.hsCode,
      grossWeightKg: facts.grossWeightKg,
      volumeM3: facts.volumeM3,
      packageCount: facts.packageCount,
      packageType: facts.packageType,
      equipment: equipment.equipment,
      shipper: facts.shipper,
      consignee: facts.consignee,
      cargoValue: facts.cargoValue,
      cargoValueCurrency: facts.cargoValueCurrency,
      customerReference: facts.customerReference,
      dangerousGoods: hazard.dangerousGoods,
      unNumber: hazard.unNumber,
      hazardClass: hazard.hazardClass,
      properShippingName: hazard.properShippingName,
      packingGroup: hazard.packingGroup,
      technicalName: hazard.technicalName,
      flashpointCelsius: hazard.flashpointCelsius,
      dgPackagingType: hazard.packagingType,
      dgPackageCount: hazard.packageCount,
      netQuantityPerPackage: hazard.netQuantityPerPackage,
      quantityUnit: hazard.quantityUnit,
      temperature: temperature.temperature,
      temperatureSetPointCelsius: facts.temperatureSetPointCelsius,
      readyDate: facts.readyDate,
      notes: facts.notes,
    };

    /*
     * Asked because the form cannot finish without them, not because the
     * document was thin: an Incoterm with no named place leaves Service open,
     * a missing weight leaves Cargo open, and Parties needs both names.
     */
    const blockers: IntakeQuestion[] = [];

    if (incoterm && !facts.namedPlace) {
      blockers.push({
        id: 'named-place',
        field: 'namedPlace',
        ask: `${incoterm} needs a named place. Which port or city does it refer to?`,
      });
    }

    if (typeof facts.grossWeightKg !== 'number' || facts.grossWeightKg <= 0) {
      blockers.push({
        id: 'gross-weight',
        field: 'grossWeightKg',
        ask: 'What is the total gross weight in kilograms?',
      });
    }

    if (!facts.shipper) {
      blockers.push({ id: 'shipper', field: 'shipper', ask: 'Who is the shipper?' });
    }

    if (!facts.consignee) {
      blockers.push({ id: 'consignee', field: 'consignee', ask: 'Who is the consignee?' });
    }

    const questions = dedupe([
      ...missingEssentials({
        originCode: facts.originCode ?? facts.originText,
        destinationCode: facts.destinationCode ?? facts.destinationText,
        readyDate: facts.readyDate,
        commodity: facts.commodity,
      }),
      ...scope.questions,
      ...equipment.questions,
      ...hazard.questions,
      ...temperature.questions,
      ...blockers,
    ]);

    return { status: 'extracted', provenance, fields, derived, questions };
  }
}

const matchContainer = (stated: string | null, containers: ContainerOption[]): string | null => {
  if (!stated) return null;
  const normalised = stated.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const hit = containers.find(
    (c) => c.code.replace(/[^a-z0-9]/gi, '').toLowerCase() === normalised,
  );
  return hit?.code ?? null;
};

const dedupe = (questions: IntakeQuestion[]): IntakeQuestion[] => {
  const seen = new Set<string>();
  return questions.filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)));
};
