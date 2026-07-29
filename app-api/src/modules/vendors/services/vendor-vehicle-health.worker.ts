import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VendorService } from './vendor.service';

/** Reconciles time-driven lease expiry holds across organizations once per hour. */
@Injectable()
export class VendorVehicleHealthWorker {
  private readonly logger = new Logger(VendorVehicleHealthWorker.name);

  constructor(private readonly vendors: VendorService) {}

  /** Runs the advisory-lock-protected global reconciliation cycle. */
  @Cron(CronExpression.EVERY_HOUR)
  async reconcileExpiredLeases(): Promise<void> {
    try {
      const result = await this.vendors.reconcileAllLinkedVehicleHealth();
      if (result.held || result.released || result.updated) {
        this.logger.log({ event: 'vendor_vehicle_health_reconciled', ...result });
      }
    } catch (error) {
      this.logger.error(
        'Vendor Vehicle health reconciliation failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
