import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  TmsTrackingAdapter,
  type TmsConsol,
  type TmsContainerUnit,
  type TmsMilestoneEvent,
  type TmsShipmentDetail,
  type TmsShipmentSummary,
} from '../../contracts/adapters/tms-tracking.adapter';
import type { TmsFetchResult, TmsPage, TmsSyncStatus, TmsTenantScope } from '../../contracts/adapters/tms-common';
import { unavailable } from '../../contracts/adapters/tms-common';

import { Cw1Client } from './cw1.client';
import { XmlCodec } from './xml.codec';

/** The CargoWise row shape. Deliberately not exported: it must not leave this file. */
interface Cw1ShipmentRow {
  shipmentId: string;
  houseBill?: string;
  masterBill?: string;
  originCode?: string;
  destinationCode?: string;
  etd?: Date;
  eta?: Date;
  status?: string;
}

/**
 * Phase 2 shipment reads, behind TmsTrackingAdapter.
 *
 * Scoped by CW1 organisation code, which is the tenant boundary on the CW1 side: the
 * caller passes the codes belonging to the resolved tenant and never a raw customer
 * input. TenantResolverService is what turns a portal tenant into that list.
 *
 * Only the list read is implemented. The ShipmentQuery message shape below is provisional
 * and unverified against a real eAdapter contract, so the other five reads refuse rather
 * than guess a message the CargoWise team has not confirmed.
 */
@Injectable()
export class Cw1ShipmentAdapter extends TmsTrackingAdapter {
  constructor(
    private readonly client: Cw1Client,
    private readonly config: ConfigService,
    private readonly xml: XmlCodec,
  ) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('cw1.eadapterUrl'));
  }

  async listShipments(scope: TmsTenantScope): Promise<TmsPage<TmsShipmentSummary>> {
    const rows = await this.listByOrgCodes(scope.orgCodes);

    return {
      items: rows.map((row) => ({
        shipmentRef: row.shipmentId,
        // The query response carries no transport mode; guessing it from the lane would
        // be an invented field.
        mode: null,
        houseBill: row.houseBill ?? null,
        masterBill: row.masterBill ?? null,
        originCode: row.originCode ?? null,
        destinationCode: row.destinationCode ?? null,
        etd: row.etd ?? null,
        eta: row.eta ?? null,
        status: row.status ?? null,
        orgCodes: scope.orgCodes,
      })),
      // CW1 ShipmentQuery exposes no cursor, so this read is a single page by construction.
      nextCursor: null,
    };
  }

  async getShipment(_scope: TmsTenantScope, _shipmentRef: string): Promise<TmsShipmentDetail | null> {
    throw new Error('Cw1ShipmentAdapter.getShipment: no confirmed CargoWise message shape yet.');
  }

  async listMilestones(_scope: TmsTenantScope, _shipmentRef: string): Promise<TmsMilestoneEvent[]> {
    throw new Error('Cw1ShipmentAdapter.listMilestones: no confirmed CargoWise message shape yet.');
  }

  async listContainers(_scope: TmsTenantScope, _shipmentRef: string): Promise<TmsContainerUnit[]> {
    throw new Error('Cw1ShipmentAdapter.listContainers: no confirmed CargoWise message shape yet.');
  }

  async listConsols(_scope: TmsTenantScope): Promise<TmsPage<TmsConsol>> {
    throw new Error('Cw1ShipmentAdapter.listConsols: no confirmed CargoWise message shape yet.');
  }

  async getConsol(_scope: TmsTenantScope, _consolRef: string): Promise<TmsConsol | null> {
    throw new Error('Cw1ShipmentAdapter.getConsol: no confirmed CargoWise message shape yet.');
  }

  /**
   * Answers `unavailable` rather than throwing, unlike the reads above.
   *
   * A catch-up poll runs on a schedule with nobody watching, so an exception
   * would be a failed job every few minutes. An empty, honestly-labelled page is
   * the same information without the noise.
   */
  async listEventsChangedSince(
    _scope: TmsTenantScope,
    _since: Date,
    _cursor?: string,
  ): Promise<TmsFetchResult<TmsPage<TmsMilestoneEvent>>> {
    return unavailable({ items: [], nextCursor: null });
  }

  async getShipmentStatus(shipmentRef: string): Promise<TmsFetchResult<TmsSyncStatus | null>> {
    if (!this.isConfigured()) {
      return unavailable(null);
    }

    return {
      data: {
        reference: shipmentRef,
        state: 'unknown',
        externalReference: null,
        detail: 'No confirmed CargoWise status message shape yet.',
        observedAt: new Date(),
      },
      retrievedAt: new Date(),
      source: 'cw1',
    };
  }

  private async listByOrgCodes(orgCodes: string[], { limit = 50 } = {}): Promise<Cw1ShipmentRow[]> {
    if (orgCodes.length === 0) {
      // No accounts resolved means no data, not "everything". Fail closed.
      return [];
    }

    const url = this.config.getOrThrow<string>('cw1.eadapterUrl');
    const body = this.xml.build('ShipmentQuery', {
      Organizations: { Code: orgCodes },
      MaxResults: String(limit),
    });

    const raw = await this.client.exchange<Cw1ShipmentQueryResponse>(url, body, { retries: 2 });

    return asArray(raw.ShipmentQueryResponse?.Shipment).map((shipment) => ({
      shipmentId: shipment.ShipmentID ?? '',
      houseBill: shipment.HouseBill,
      masterBill: shipment.MasterBill,
      originCode: shipment.Origin?.UNLOCODE,
      destinationCode: shipment.Destination?.UNLOCODE,
      etd: shipment.ETD ? new Date(shipment.ETD) : undefined,
      eta: shipment.ETA ? new Date(shipment.ETA) : undefined,
      status: shipment.Status,
    }));
  }
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

interface Cw1Shipment {
  ShipmentID?: string;
  HouseBill?: string;
  MasterBill?: string;
  Origin?: { UNLOCODE?: string };
  Destination?: { UNLOCODE?: string };
  ETD?: string;
  ETA?: string;
  Status?: string;
}

interface Cw1ShipmentQueryResponse {
  ShipmentQueryResponse?: { Shipment?: Cw1Shipment | Cw1Shipment[] };
}
