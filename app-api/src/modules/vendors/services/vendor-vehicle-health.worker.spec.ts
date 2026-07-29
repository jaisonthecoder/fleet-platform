import { VendorVehicleHealthWorker } from './vendor-vehicle-health.worker';

describe('VendorVehicleHealthWorker', () => {
  it('runs the global reconciliation through VendorService', async () => {
    const vendors = {
      reconcileAllLinkedVehicleHealth: jest.fn().mockResolvedValue({
        held: 1,
        released: 0,
        updated: 0,
      }),
    };
    const worker = new VendorVehicleHealthWorker(vendors as never);

    await expect(worker.reconcileExpiredLeases()).resolves.toBeUndefined();
    expect(vendors.reconcileAllLinkedVehicleHealth).toHaveBeenCalledTimes(1);
  });

  it('contains reconciliation failures so the scheduler remains active', async () => {
    const vendors = {
      reconcileAllLinkedVehicleHealth: jest
        .fn()
        .mockRejectedValue(new Error('database unavailable')),
    };
    const worker = new VendorVehicleHealthWorker(vendors as never);

    await expect(worker.reconcileExpiredLeases()).resolves.toBeUndefined();
  });
});
