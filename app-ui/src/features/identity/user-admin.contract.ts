import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { PLATFORM_ROLES, type PlatformRole } from '@/features/auth/roles'

/**
 * A workforce-directory row — mirrors backend `UserDirectoryDto`. The base
 * entity is the HR person, so `personId` is always present and every person is
 * role-assignable; `userId` is the linked SSO login account or null.
 */
export interface UserDirectory {
  /** HR person id — always present; the target of role assign/revoke. */
  personId: string
  /** Linked SSO login account id, or null if the person has never signed in. */
  userId: string | null
  /** Full name from the HR master. */
  name: string
  /** Person email, falling back to the account email; null if neither is set. */
  email: string | null
  /** HCM employee id (falls back to a short person id). */
  employeeId: string
  /** HR grade, or null. */
  grade: string | null
  /** Distinct active role names the person holds. */
  roles: string[]
  /** Primary scope node name (first active assignment), or null. */
  cluster: string | null
  /** Last successful sign-in (ISO-8601), or null if never signed in. */
  lastLoginAt: string | null
  /** Raw account status, or 'NoLogin' when the person has no account yet. */
  accountStatus: string
  /** Surface status for the grid chip (mirrors accountStatus). */
  status: string
}

/** User-population summary tiles — mirrors backend `UserSummaryDto`. */
export interface UserSummary {
  employees: number
  fleetManagers: number
  executives: number
  administrators: number
}

/** One active role a person holds — mirrors backend `UserRoleDto`. */
export interface UserRole {
  assignmentId: string
  role: string
  scopeNodeId: string
  scopeName: string | null
  source: string
}

/** One row of the access-review export — mirrors backend `AccessReviewRow`. */
export interface AccessReviewRow {
  assignmentId: string
  personId: string
  role: string
  scopeNodeId: string
  source: string
  assignedByPersonId: string | null
}

/** A generic paged result envelope — mirrors backend `PagedResult<T>`. */
export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Account lifecycle status — mirrors backend `listUsersQuerySchema.status`. */
export const USER_STATUSES = ['Active', 'Suspended', 'Deprovisioned', 'NoLogin'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

/** Provenance of a role grant — mirrors backend `roleSourceSchema`. */
export const ROLE_SOURCES = ['manual', 'hcm', 'entra-group'] as const

const userDirectorySchema = z.object({
  personId: z.string(),
  userId: z.string().nullable(),
  name: z.string(),
  email: z.string().nullable(),
  employeeId: z.string(),
  grade: z.string().nullable(),
  roles: z.array(z.string()),
  cluster: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
  accountStatus: z.string(),
  status: z.string(),
})

const pagedUserSchema = z.object({
  items: z.array(userDirectorySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})

const userSummarySchema = z.object({
  employees: z.number(),
  fleetManagers: z.number(),
  executives: z.number(),
  administrators: z.number(),
})

const userRoleSchema = z.object({
  assignmentId: z.string(),
  role: z.string(),
  scopeNodeId: z.string(),
  scopeName: z.string().nullable(),
  source: z.string(),
})

const accessReviewRowSchema = z.object({
  assignmentId: z.string(),
  personId: z.string(),
  role: z.string(),
  scopeNodeId: z.string(),
  source: z.string(),
  assignedByPersonId: z.string().nullable(),
})

/** Assign a role at a scope (mirrors backend `assignRoleSchema`; SoD-checked server-side). */
export const assignRoleSchema = z.object({
  personId: z.string().uuid(),
  role: z.enum(PLATFORM_ROLES),
  scopeNodeId: z.string().uuid(),
  source: z.enum(ROLE_SOURCES).optional(),
})
export type AssignRole = z.infer<typeof assignRoleSchema>

/** Query for the paged user-accounts grid (mirrors `listUsersQuerySchema`). */
export interface ListUsersQuery {
  search?: string
  status?: UserStatus
  role?: PlatformRole
  page?: number
  pageSize?: number
}

/** Builds the query string for the users grid. */
function toUsersQueryString(query: ListUsersQuery): string {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.status) params.set('status', query.status)
  if (query.role) params.set('role', query.role)
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** `GET /api/v1/admin/users` — paged, filtered workforce directory. */
export async function fetchUsers(query: ListUsersQuery = {}): Promise<PagedResult<UserDirectory>> {
  return pagedUserSchema.parse(await apiClient.get(`/v1/admin/users${toUsersQueryString(query)}`))
}

/** `GET /api/v1/admin/users/summary` — population tiles by role family. */
export async function fetchUserSummary(): Promise<UserSummary> {
  return userSummarySchema.parse(await apiClient.get('/v1/admin/users/summary'))
}

/** `GET /api/v1/admin/users/:personId/roles` — a person's active role assignments. */
export async function fetchUserRoles(personId: string): Promise<UserRole[]> {
  return z.array(userRoleSchema).parse(await apiClient.get(`/v1/admin/users/${personId}/roles`))
}

/** `GET /api/v1/admin/access-review` — "who has what, where". */
export async function fetchAccessReview(): Promise<AccessReviewRow[]> {
  return z.array(accessReviewRowSchema).parse(await apiClient.get('/v1/admin/access-review'))
}

/** `POST /api/v1/admin/roles` — assign a role (the acting admin is recorded server-side). */
export async function assignRole(body: AssignRole): Promise<unknown> {
  return apiClient.post('/v1/admin/roles', { ...body, source: body.source ?? 'manual' })
}

/** `DELETE /api/v1/admin/roles/:assignmentId` — revoke a role grant. */
export async function revokeRole(assignmentId: string): Promise<void> {
  await apiClient.delete(`/v1/admin/roles/${assignmentId}`)
}

/** `POST /api/v1/admin/users/:id/{suspend|reactivate}`. */
export async function setUserStatus(userId: string, action: 'suspend' | 'reactivate'): Promise<unknown> {
  return apiClient.post(`/v1/admin/users/${userId}/${action}`)
}

export const ASSIGNABLE_ROLES: readonly PlatformRole[] = PLATFORM_ROLES
