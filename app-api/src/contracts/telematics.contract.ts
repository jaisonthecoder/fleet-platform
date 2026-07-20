import { z } from 'zod';

const money = z.union([z.number(), z.string()]).transform((v) => String(v));

export const registerDeviceSchema = z.object({
  identifier: z.string().min(1),
  model: z.string().optional(),
  firmware: z.string().optional(),
  sim: z.string().optional(),
});
export type RegisterDevice = z.infer<typeof registerDeviceSchema>;

export const pairDeviceSchema = z.object({
  deviceId: z.string().uuid(),
  vehicleId: z.string().uuid(),
});
export type PairDevice = z.infer<typeof pairDeviceSchema>;

export const startTripSchema = z.object({
  vehicleId: z.string().uuid(),
  deviceId: z.string().uuid().optional(),
  startedAt: z.string().optional(),
  startOdometer: money.optional(),
});
export type StartTrip = z.infer<typeof startTripSchema>;

export const endTripSchema = z.object({
  endedAt: z.string().optional(),
  endOdometer: money.optional(),
  distanceKm: money.optional(),
});
export type EndTrip = z.infer<typeof endTripSchema>;

export const raiseAlertSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  alertType: z.enum(['Unplug', 'Tamper', 'DeviceSilent']),
  detail: z.string().optional(),
});
export type RaiseAlert = z.infer<typeof raiseAlertSchema>;

export interface DeviceDto {
  id: string;
  identifier: string;
  status: string;
}

export interface TripDto {
  id: string;
  vehicleId: string;
  bookingId: string | null;
  driverPersonId: string | null;
  attributionBasis: string | null;
  endedAt: string | null;
}

export interface LivePositionDto {
  vehicleId: string;
  lat: number | null;
  lon: number | null;
  speed: number | null;
  ignition: boolean | null;
  at: string | null;
  online: boolean;
}
