import { z } from 'zod';

export const consentDomainSchema = z.enum(['Booking', 'DedicatedVehicle']);
export type ConsentDomain = z.infer<typeof consentDomainSchema>;
export const consentStatusSchema = z.enum(['Draft', 'Active', 'Retired']);
export type ConsentStatus = z.infer<typeof consentStatusSchema>;

export const createConsentTemplateSchema = z.object({
  domain: consentDomainSchema,
  version: z.string().trim().min(1).max(80),
  effectiveAtUtc: z.string().datetime(),
  content: z.object({
    en: z.string().trim().min(20).max(20_000),
    ar: z.string().trim().min(20).max(20_000),
  }),
}).strict();
export type CreateConsentTemplate = z.infer<typeof createConsentTemplateSchema>;

export interface ConsentTemplateDto {
  id: string;
  domain: ConsentDomain;
  version: string;
  status: ConsentStatus;
  contentHash: string;
  effectiveAtUtc: string;
  content: { en: string; ar: string };
  createdByPersonId: string;
  activatedByPersonId: string | null;
  activatedAtUtc: string | null;
  retiredAtUtc: string | null;
  createdAtUtc: string;
}
