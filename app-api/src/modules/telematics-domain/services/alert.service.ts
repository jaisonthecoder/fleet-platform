import { Injectable } from '@nestjs/common';
import { toDbException } from '../../../common/database/pg-error';
import type { RaiseAlert } from '../../../contracts/telematics.contract';
import { TelematicsRepository } from '../repositories/telematics.repository';

/**
 * Telematics alerts (unplug / tamper / device-silent). Raised from injected
 * canonical events (e.g. the ingest pipe emits `DeviceSilent`); a consumer
 * calls {@link raiseAlert}. Stewards acknowledge from the alerts view.
 */
@Injectable()
export class AlertService {
  constructor(private readonly repo: TelematicsRepository) {}

  async raiseAlert(input: RaiseAlert) {
    try {
      return await this.repo.insertAlert({
        vehicleId: input.vehicleId ?? null,
        deviceId: input.deviceId ?? null,
        alertType: input.alertType,
        detail: input.detail ?? null,
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  list() {
    return this.repo.listAlerts();
  }

  async acknowledge(id: string): Promise<{ ok: true }> {
    await this.repo.acknowledgeAlert(id);
    return { ok: true };
  }
}
