import { z } from 'zod';

export const attentionItemSchema = z.object({
  id: z.string(),
  level: z.enum(['danger', 'warning', 'info']),
  title: z.string(),
  detail: z.string(),
  action: z.string(),
});

export const upcomingBookingSchema = z.object({
  id: z.string(),
  time: z.string(),
  route: z.string(),
  plate: z.string(),
  status: z.enum(['Ready', 'Hold', 'Pending']),
});

export const operationsOverviewSchema = z.object({
  scope: z.object({ id: z.string(), label: z.string() }),
  generatedAt: z.string().datetime(),
  summary: z.object({
    availableVehicles: z.number().int().nonnegative(),
    totalVehicles: z.number().int().nonnegative(),
    bookingsToday: z.number().int().nonnegative(),
    activeBookings: z.number().int().nonnegative(),
    attentionCount: z.number().int().nonnegative(),
    complianceAttentionCount: z.number().int().nonnegative(),
    utilizationPercent: z.number().min(0).max(100),
    utilizationChangePercent: z.number(),
  }),
  availability: z.object({
    available: z.number().int().nonnegative(),
    inUse: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
  }),
  attentionItems: z.array(attentionItemSchema),
  upcomingBookings: z.array(upcomingBookingSchema),
});

export type OperationsOverview = z.infer<typeof operationsOverviewSchema>;
