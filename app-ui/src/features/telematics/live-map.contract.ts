import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

export const liveFleetPositionSchema = z.object({
  vehicleId: z.string(),
  plate: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  speed: z.number().nullable(),
  at: z.string().nullable(),
  online: z.boolean(),
})
export type LiveFleetPosition = z.infer<typeof liveFleetPositionSchema>

/** Latest position per scoped vehicle for the fleet live map (audited server-side). */
export async function fetchFleetLive(): Promise<LiveFleetPosition[]> {
  return z
    .array(liveFleetPositionSchema)
    .parse(await apiClient.get('/v1/telematics/live'))
}
