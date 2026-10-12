import { z } from 'zod';

export const addressBookEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postcode: z.string().trim().max(20).optional(),
  // ISO 3166-1 alpha-2.
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  cw1OrgCode: z.string().trim().max(40).optional(),
  isDefault: z.boolean().default(false),
});

export const updateAddressBookEntrySchema = addressBookEntrySchema.partial();

export type AddressBookEntryInput = z.infer<typeof addressBookEntrySchema>;
export type UpdateAddressBookEntryInput = z.infer<typeof updateAddressBookEntrySchema>;
