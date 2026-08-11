import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

/** Computed lifecycle status of one driver credential. */
export const credentialStatusSchema = z.enum([
  'Missing',
  'Valid',
  'ExpiringSoon',
  'Expired',
])
export type CredentialStatus = z.infer<typeof credentialStatusSchema>

export const credentialFieldSchema = z.object({
  number: z.string().nullable(),
  expiry: z.string().nullable(),
  status: credentialStatusSchema,
  source: z.string().nullable(),
  verified: z.boolean(),
})
export type CredentialField = z.infer<typeof credentialFieldSchema>

export const myCredentialsSchema = z.object({
  licence: credentialFieldSchema,
  emiratesId: credentialFieldSchema,
})
export type MyCredentials = z.infer<typeof myCredentialsSchema>

/** The subset of a person's credentials a manual capture may set. */
export interface UpdateCredentialsInput {
  licenceNumber?: string
  licenceExpiry?: string
  emiratesId?: string
  emiratesIdExpiry?: string
}

/** `GET /me/credentials` — the caller's own credential status + provenance. */
export async function fetchMyCredentials(): Promise<MyCredentials> {
  return myCredentialsSchema.parse(await apiClient.get('/v1/me/credentials'))
}

/** `PATCH /me/credentials` — self-service capture (stored as Unverified). */
export async function updateMyCredentials(
  input: UpdateCredentialsInput,
): Promise<MyCredentials> {
  return myCredentialsSchema.parse(
    await apiClient.patch('/v1/me/credentials', input),
  )
}

/** `PATCH /admin/persons/:id/credentials` — admin/steward capture (Verified). */
export async function updatePersonCredentials(
  personId: string,
  input: UpdateCredentialsInput,
): Promise<MyCredentials> {
  return myCredentialsSchema.parse(
    await apiClient.patch(`/v1/admin/persons/${personId}/credentials`, input),
  )
}
