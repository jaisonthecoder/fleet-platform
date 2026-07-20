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
