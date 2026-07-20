import type { PlatformRole } from '../database/schema';

/** A role the principal holds at a hierarchy scope. */
export interface PrincipalRole {
  role: PlatformRole;
  scopeNodeId: string;
}

/**
 * The authenticated caller attached to the request by the {@link AuthGuard}.
 * Sourced from a verified Entra JWT (production) or the dev-login stand-in
 * (lower environments only).
 */
export interface Principal {
  /** Organization owning the linked HR person and every authorized scope. */
  organizationId: string;
  /** `user_account` id (null for a dev-login without a provisioned account). */
  userId: string | null;
  /** Linked HR person id (null until an admin links the account). */
  personId: string | null;
  entraObjectId: string | null;
  email: string | null;
  roles: PrincipalRole[];
  /** True when authenticated via the dev-login stand-in, not a real token. */
  isDevLogin: boolean;
}

/** Fastify request augmented with the authenticated principal. */
export interface RequestWithPrincipal {
  principal?: Principal;
  headers: Record<string, string | string[] | undefined>;
}
