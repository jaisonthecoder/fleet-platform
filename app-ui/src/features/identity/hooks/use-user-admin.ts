import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignRole,
  fetchAccessReview,
  fetchUserRoles,
  fetchUsers,
  fetchUserSummary,
  revokeRole,
  setUserStatus,
  type AssignRole,
  type ListUsersQuery,
} from '../user-admin.contract'

/** `GET /admin/users` (paged/filtered; query is part of the cache key). */
export function useUsers(query: ListUsersQuery) {
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => fetchUsers(query),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })
}

/** `GET /admin/users/summary` (KPI tiles). */
export function useUserSummary() {
  return useQuery({
    queryKey: ['admin', 'users', 'summary'],
    queryFn: fetchUserSummary,
    staleTime: 60 * 1000,
  })
}

/** `GET /admin/users/:personId/roles` (per-person role assignments; enabled when a person is set). */
export function useUserRoles(personId: string | null) {
  return useQuery({
    queryKey: ['admin', 'users', personId, 'roles'],
    queryFn: () => fetchUserRoles(personId as string),
    enabled: Boolean(personId),
    staleTime: 30 * 1000,
  })
}

/** `GET /admin/access-review` (who has what, where). */
export function useAccessReview() {
  return useQuery({ queryKey: ['admin', 'access-review'], queryFn: fetchAccessReview, staleTime: 60 * 1000 })
}

/** Invalidates the users grid + summary + access review after a change. */
function invalidateUsers(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  void queryClient.invalidateQueries({ queryKey: ['admin', 'access-review'] })
}

/** Assign a role; refreshes users + roles + access review. */
export function useAssignRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AssignRole) => assignRole(body),
    onSuccess: () => invalidateUsers(queryClient),
  })
}

/** Revoke a role grant by assignment id; refreshes users + roles + access review. */
export function useRevokeRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: string) => revokeRole(assignmentId),
    onSuccess: () => invalidateUsers(queryClient),
  })
}

/** Suspend / reactivate a user; refreshes the users list. */
export function useSetUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'suspend' | 'reactivate' }) =>
      setUserStatus(userId, action),
    onSuccess: () => invalidateUsers(queryClient),
  })
}
