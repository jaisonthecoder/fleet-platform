import { Injectable, NotFoundException } from '@nestjs/common';
import { toDbException } from '../../../common/database/pg-error';
import type { DeviceDto, PairDevice, RegisterDevice } from '../../../contracts/telematics.contract';
import { AuditService } from '../../platform/services/audit.service';
import { TelematicsRepository } from '../repositories/telematics.repository';

/**
 * Device registry + effective-dated pairing. A device is independent of the
 * vehicle (survives transfers/off-hires). Pairing closes any active pairing for
 * both the device and the vehicle at one shared instant (strictly adjacent
 * ranges) and opens a new one — the `btree_gist` exclusion is the real guard.
 */
@Injectable()
export class DeviceService {
  constructor(
    private readonly repo: TelematicsRepository,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterDevice, actorRef = 'system'): Promise<DeviceDto> {
    try {
      const created = await this.repo.insertDevice({
        identifier: input.identifier,
        model: input.model ?? null,
        firmware: input.firmware ?? null,
        sim: input.sim ?? null,
        status: 'Registered',
      });
      await this.audit.record({
        actorRef,
        action: 'DEVICE_REGISTERED',
        entityRef: `device:${created.id}`,
        after: { identifier: created.identifier },
      });
      return { id: created.id, identifier: created.identifier, status: created.status };
    } catch (error) {
      throw toDbException(error);
    }
  }

  async pair(input: PairDevice, actorRef = 'system'): Promise<{ ok: true }> {
    const found = await this.repo.findDevice(input.deviceId);
    if (!found) {
      throw new NotFoundException({ title: 'Unknown device', reasons: [`device-not-found:${input.deviceId}`] });
    }
    const now = new Date();
    try {
      await this.repo.transaction(async (tx) => {
        const deviceActive = await this.repo.activePairingForDevice(input.deviceId);
        if (deviceActive) await this.repo.expirePairing(deviceActive.id, now, tx);
        const vehicleActive = await this.repo.activePairingForVehicle(input.vehicleId);
        if (vehicleActive) await this.repo.expirePairing(vehicleActive.id, now, tx);
        await this.repo.insertPairing(
          { deviceId: input.deviceId, vehicleId: input.vehicleId, validFrom: now },
          tx,
        );
      });
    } catch (error) {
      throw toDbException(error);
    }
    await this.audit.record({
      actorRef,
      action: 'DEVICE_PAIRED',
      entityRef: `device:${input.deviceId}`,
      after: { vehicleId: input.vehicleId },
    });
    return { ok: true };
  }

  async unpair(deviceId: string, actorRef = 'system'): Promise<{ ok: true }> {
    const active = await this.repo.activePairingForDevice(deviceId);
    if (active) {
      await this.repo.expirePairing(active.id, new Date());
    }
    await this.audit.record({ actorRef, action: 'DEVICE_UNPAIRED', entityRef: `device:${deviceId}` });
    return { ok: true };
  }

  async list(): Promise<DeviceDto[]> {
    const devices = await this.repo.listDevices();
    return devices.map((d) => ({ id: d.id, identifier: d.identifier, status: d.status }));
  }
}
