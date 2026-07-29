import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

export const consentDomainSchema = z.enum(['Booking', 'DedicatedVehicle'])
export type ConsentDomain = z.infer<typeof consentDomainSchema>
export const consentTemplateSchema = z.object({
  id: z.string().uuid(), domain: consentDomainSchema, version: z.string(), status: z.enum(['Draft', 'Active', 'Retired']),
  contentHash: z.string(), effectiveAtUtc: z.string(), content: z.object({ en: z.string(), ar: z.string() }),
  createdByPersonId: z.string().uuid(), activatedByPersonId: z.string().uuid().nullable(),
  activatedAtUtc: z.string().nullable(), retiredAtUtc: z.string().nullable(), createdAtUtc: z.string(),
})
export type ConsentTemplate = z.infer<typeof consentTemplateSchema>

/** Lists governed consent versions for one domain. */
export async function getConsentTemplates(domain: ConsentDomain): Promise<ConsentTemplate[]> {
  return z.array(consentTemplateSchema).parse(await apiClient.get(`/v1/admin/consents?domain=${domain}`))
}

/** Creates one immutable bilingual Draft version. */
export async function createConsentTemplate(input: { domain: ConsentDomain; version: string; effectiveAtUtc: string; content: { en: string; ar: string } }): Promise<ConsentTemplate> {
  return consentTemplateSchema.parse(await apiClient.post('/v1/admin/consents', input))
}

/** Activates a Draft as the approved production source. */
export async function activateConsentTemplate(id: string): Promise<ConsentTemplate> {
  return consentTemplateSchema.parse(await apiClient.post(`/v1/admin/consents/${id}/activate`))
}

/** Retires active wording and returns the domain to fail-closed state. */
export async function retireConsentTemplate(id: string): Promise<ConsentTemplate> {
  return consentTemplateSchema.parse(await apiClient.post(`/v1/admin/consents/${id}/retire`))
}
