import { z } from 'zod';

/** Request body to create a time-boxed delegation (FR-DEL-01). */
export const createDelegationSchema = z.object({
  delegatePersonId: z.string().min(1),
  requestType: z.string().min(1),
  validFrom: z.string().min(1),
  validTo: z.string().min(1),
}).strict();
export type CreateDelegation = z.infer<typeof createDelegationSchema>;

/** A role a person holds at a hierarchy scope. */
export interface RoleAtScope {
  role: string;
  scopeNodeId: string;
  scopeName: string | null;
}

/** The `GET /me` response: identity + roles/scopes for RBAC and the Scope Switcher. */
export interface MeResponse {
  organizationId: string;
  personId: string;
  fullName: string;
  email: string | null;
  grade: string | null;
  employmentStatus: string;
  homePoolNodeId: string | null;
  roles: RoleAtScope[];
}

/** Computed lifecycle status of one driver credential (autofill/warnings). */
export type CredentialStatus = 'Missing' | 'Valid' | 'ExpiringSoon' | 'Expired';

/** One credential field's value + computed status + provenance. */
export interface CredentialFieldDto {
  number: string | null;
  expiry: string | null;
  status: CredentialStatus;
  /** 'hcm' | 'manual' | 'seed' | null. */
  source: string | null;
  /** True when HCM-sourced or steward-verified; self-entry stays false. */
  verified: boolean;
}

/**
 * `GET /me/credentials` — the caller's own driver-credential status, used by the
 * UI to auto-fill known values and warn before expiry.
 */
export interface MeCredentialsResponse {
  licence: CredentialFieldDto;
  emiratesId: CredentialFieldDto;
}

/** ISO date-only (YYYY-MM-DD) validator for credential expiries. */
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry must be an ISO date (YYYY-MM-DD)');

/**
 * Manual credential capture (licence / Emirates ID number + expiry). Used by the
 * employee for their **own** record (self-service) and by an admin/steward for
 * any person. At least one field is required.
 */
export const updateCredentialsSchema = z
  .object({
    licenceNumber: z.string().trim().min(1).max(64).optional(),
    licenceExpiry: isoDateString.optional(),
    emiratesId: z.string().trim().min(1).max(64).optional(),
    emiratesIdExpiry: isoDateString.optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.licenceNumber !== undefined ||
      d.licenceExpiry !== undefined ||
      d.emiratesId !== undefined ||
      d.emiratesIdExpiry !== undefined,
    { message: 'at least one credential field is required' },
  );
export type UpdateCredentials = z.infer<typeof updateCredentialsSchema>;

/** A node in the configurable hierarchy tree (nested for the UI). */
export interface HierarchyNodeDto {
  id: string;
  parentId: string | null;
  levelIndex: number;
  levelLabel: string;
  name: string;
  path: string;
  children: HierarchyNodeDto[];
}
