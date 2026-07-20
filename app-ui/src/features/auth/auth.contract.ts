import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

/** A role the principal holds at a hierarchy scope (mirrors backend `MeResponse`). */
export const meRoleSchema = z.object({
  role: z.string(),
  scopeNodeId: z.string(),
  scopeName: z.string().nullish(),
})

/** The authenticated principal returned by `GET /api/v1/me`. */
export const meSchema = z.object({
  organizationId: z.string().uuid(),
  personId: z.string(),
  fullName: z.string(),
  email: z.string().nullish(),
  grade: z.string().nullish(),
  employmentStatus: z.string().nullish(),
  homePoolNodeId: z.string().nullish(),
  roles: z.array(meRoleSchema),
})

export type Me = z.infer<typeof meSchema>

/** Fetches + validates the authenticated principal from the backend. */
export async function fetchMe(): Promise<Me> {
  return meSchema.parse(await apiClient.get('/v1/me'))
}

/** A seeded user offered by the dev-login picker (lower environments only). */
export const devUserSchema = z.object({
  personId: z.string(),
  fullName: z.string(),
  email: z.string().nullish(),
  grade: z.string().nullish(),
  roles: z.array(
    z.object({ role: z.string(), scopeName: z.string().nullish() }),
  ),
})

export type DevUser = z.infer<typeof devUserSchema>

/** Lists the seeded dev-login users from the backend (`GET /api/v1/dev/users`). */
export async function fetchDevUsers(): Promise<DevUser[]> {
  return z.array(devUserSchema).parse(await apiClient.get('/v1/dev/users'))
}
