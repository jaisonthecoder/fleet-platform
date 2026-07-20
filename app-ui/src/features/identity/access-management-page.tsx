import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Building2,
  Download,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { StatusChip } from '@/components/ui/status-chip'
import { StatCard } from '@/components/patterns/stat-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { useHierarchy } from '@/features/platform/hooks/use-hierarchy'
import { flattenHierarchy } from '@/features/platform/platform.contract'
import { PLATFORM_ROLES, type PlatformRole } from '@/features/auth/roles'
import { useConfirm } from '@/hooks/use-confirm'
import { notify } from '@/hooks/use-toast'
import { ApiRequestError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  USER_STATUSES,
  type ListUsersQuery,
  type UserDirectory,
  type UserStatus,
} from './user-admin.contract'
import {
  useAccessReview,
  useAssignRole,
  useRevokeRole,
  useSetUserStatus,
  useUserRoles,
  useUsers,
  useUserSummary,
} from './hooks/use-user-admin'

/** Short descriptions for the role presets shown in the assignment sheet. */
const ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  Employee: 'Book and use pool vehicles.',
  Approver: 'Approve booking and entitlement requests.',
  Delegate: 'Act on behalf of an approver.',
  FleetManager: "Manage a pool's vehicles, handovers and fines.",
  ClusterFleetLead: 'Oversee fleet operations across a cluster.',
  GroupFleetLead: 'Group-wide fleet oversight.',
  ClusterCEO: 'Approve dedicated-vehicle entitlements for a cluster.',
  Procurement: 'Manage vendors, leases and procurement.',
  Finance: 'Full cost visibility and financial recovery.',
  HR: 'Handle black-point transfers and HR actions.',
  InsuranceLead: 'Manage insurance policies and claims.',
  HSE: 'Health, safety and compliance actions.',
  InternalAudit: 'Read-only audit and access review.',
  Executive: 'Aggregate dashboards (no per-user cost).',
  DataSteward: 'Manage reference data and migrations.',
  SystemAdmin: 'Full platform administration.',
  SubstituteDriver: 'Temporary driver for substitution windows.',
  ProfessionalDriver: 'Designated professional driver.',
}

const PAGE_SIZE = 25
const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  active: 'ok',
  suspended: 'danger',
  deprovisioned: 'neutral',
  nologin: 'neutral',
  invited: 'neutral',
}

function reportError(error: unknown, fallback: string): void {
  if (error instanceof ApiRequestError) {
    notify.danger(error.message || fallback, { description: error.reasons?.join(' · ') })
  } else {
    notify.danger(fallback)
  }
}

/** Compact relative-time label for a last-sign-in timestamp ('Never' if unset). */
function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'Never'
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

/** Downloads rows as a CSV file (access-review recertification export). */
function downloadCsv<T extends object>(filename: string, rows: readonly T[]): void {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0] as Record<string, unknown>)
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(',')),
  ].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Manage-user right Sheet ─────────────────────────────────────────────────

interface ManageUserSheetProps {
  user: UserDirectory | null
  onClose: () => void
}

function ManageUserSheet({ user, onClose }: ManageUserSheetProps) {
  const roles = useUserRoles(user?.personId ?? null)
  const assign = useAssignRole()
  const revoke = useRevokeRole()
  const setStatus = useSetUserStatus()
  const confirm = useConfirm()
  const { data: hierarchy } = useHierarchy()

  const [role, setRole] = useState('')
  const [scopeNodeId, setScopeNodeId] = useState('')

  // Reset the form each time a different person is opened.
  useEffect(() => {
    setRole('')
    setScopeNodeId('')
  }, [user?.personId])

  const scopeOptions = useMemo(
    () =>
      flattenHierarchy(hierarchy ?? [])
        .filter((n) => n.depth <= 1)
        .map((n) => ({
          id: n.id,
          label: n.depth === 0 ? 'Group-wide' : n.name,
        })),
    [hierarchy],
  )

  const hasAccount = Boolean(user?.userId)
  const suspended = (user?.status ?? '').toLowerCase() === 'suspended'

  async function onAssign(): Promise<void> {
    if (!user?.personId || !role || !scopeNodeId) {
      notify.warn('Pick a role and a scope first')
      return
    }
    try {
      await assign.mutateAsync({ personId: user.personId, role: role as PlatformRole, scopeNodeId })
      notify.ok(`Assigned ${role}`)
      setRole('')
      setScopeNodeId('')
    } catch (error) {
      reportError(error, 'Could not assign the role (may violate a Segregation-of-Duties rule)')
    }
  }

  async function onRevoke(assignmentId: string, roleName: string): Promise<void> {
    const ok = await confirm({
      title: `Revoke ${roleName}?`,
      description: 'The user immediately loses this role at the given scope.',
      confirmLabel: 'Revoke',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await revoke.mutateAsync(assignmentId)
      notify.ok(`Revoked ${roleName}`)
    } catch (error) {
      reportError(error, 'Could not revoke the role')
    }
  }

  async function onStatus(): Promise<void> {
    if (!user?.userId) return
    const action = suspended ? 'reactivate' : 'suspend'
    const ok = await confirm({
      title: `${suspended ? 'Reactivate' : 'Suspend'} ${user.name}?`,
      description: suspended
        ? 'Restores platform access for this account.'
        : 'The account cannot access the platform until reactivated.',
      confirmLabel: suspended ? 'Reactivate' : 'Suspend',
      tone: suspended ? 'default' : 'danger',
    })
    if (!ok) return
    try {
      await setStatus.mutateAsync({ userId: user.userId, action })
      notify.ok(`${suspended ? 'Reactivated' : 'Suspended'} ${user.name}`)
    } catch (error) {
      reportError(error, 'Could not update the account status')
    }
  }

  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-lg">
        <div className="border-b border-border px-6 py-5">
          <p className="eyebrow mb-1">Identity · Manage access</p>
          <SheetTitle className="text-lg font-bold">{user?.name ?? ''}</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            {user ? `${user.employeeId}${user.email ? ` · ${user.email}` : ''}` : ''}
          </SheetDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Current roles */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Current roles</h3>
            {roles.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading roles…</p>
            ) : (roles.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No active roles.</p>
            ) : (
              <ul className="divide-y divide-border rounded-[3px] border border-border bg-card">
                {roles.data?.map((r) => (
                  <li key={r.assignmentId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{r.role}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.scopeName ?? r.scopeNodeId} · {r.source}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={revoke.isPending}
                      onClick={() => void onRevoke(r.assignmentId, r.role)}
                      aria-label={`Revoke ${r.role}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" /> Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Assign a role — available for every person (personId is always present). */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Assign a role</h3>
            <RadioGroup
              value={role}
              onValueChange={setRole}
              className="max-h-64 gap-1.5 overflow-y-auto rounded-[3px] border border-border p-2"
            >
              {PLATFORM_ROLES.map((r) => {
                const id = `role-${r}`
                return (
                  <div
                    key={r}
                    className="flex items-start gap-3 rounded-[3px] px-2 py-1.5 hover:bg-surface-hover"
                  >
                    <RadioGroupItem id={id} value={r} className="mt-0.5" />
                    <label htmlFor={id} className="min-w-0 cursor-pointer">
                      <span className="block text-sm font-semibold text-foreground">{r}</span>
                      <span className="block text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[r]}
                      </span>
                    </label>
                  </div>
                )
              })}
            </RadioGroup>

            <div>
              <p className="eyebrow mb-1.5">Scope</p>
              <div className="flex flex-wrap gap-2">
                {scopeOptions.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Loading scopes…</span>
                ) : (
                  scopeOptions.map((s) => {
                    const active = s.id === scopeNodeId
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setScopeNodeId(s.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-[3px] border px-3 py-1.5 text-sm transition-colors',
                          active
                            ? 'border-signal bg-signal/10 text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:bg-surface-hover',
                        )}
                      >
                        <Building2 className="size-3.5" aria-hidden="true" />
                        {s.label}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              The server rejects grants that would violate a Segregation-of-Duties rule (e.g.
              Finance + Fleet Manager on the same scope).
            </p>

            <Button
              className="w-full"
              disabled={assign.isPending || !role || !scopeNodeId}
              onClick={() => void onAssign()}
            >
              {assign.isPending ? 'Assigning…' : 'Save assignment'}
            </Button>
          </section>
        </div>

        <div className="flex justify-between gap-2 border-t border-border px-6 py-4">
          {hasAccount ? (
            <Button variant={suspended ? 'default' : 'secondary'} onClick={() => void onStatus()}>
              {suspended ? 'Reactivate account' : 'Suspend account'}
            </Button>
          ) : (
            <span className="self-center text-xs text-muted-foreground">
              No login account yet — nothing to suspend.
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * User & access management — `/{lang}/admin/access` (FR-IAM-05). SystemAdmin
 * lists accounts (server-paged/filtered), reviews role assignments, assigns and
 * revokes hierarchy-scoped roles (SoD-checked server-side), and suspends /
 * reactivates accounts. All actions happen in a right-side Sheet.
 */
export function AccessManagementPage() {
  const summary = useUserSummary()
  const accessReview = useAccessReview()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | UserStatus>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | PlatformRole>('all')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<UserDirectory | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(id)
  }, [searchInput])

  const query = useMemo<ListUsersQuery>(
    () => ({
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      role: roleFilter === 'all' ? undefined : roleFilter,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, status, roleFilter, page],
  )
  const users = useUsers(query)

  const columns = useMemo<ColumnDef<UserDirectory>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'User',
        cell: ({ row }) => {
          const u = row.original
          return (
            <div className="min-w-0">
              <div className="font-medium text-foreground">{u.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {u.employeeId}
                {u.email ? ` · ${u.email}` : ''}
              </div>
            </div>
          )
        },
      },
      {
        id: 'roles',
        header: 'Role(s)',
        enableSorting: false,
        cell: ({ row }) => {
          const roles = row.original.roles
          if (roles.length === 0) return <span className="text-muted-foreground">No role</span>
          return (
            <div className="flex flex-wrap gap-1">
              {roles.slice(0, 3).map((r) => (
                <span
                  key={r}
                  className="rounded-[3px] border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
                >
                  {r}
                </span>
              ))}
              {roles.length > 3 ? (
                <span className="text-xs text-muted-foreground">+{roles.length - 3}</span>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: 'cluster',
        header: 'Cluster',
        cell: ({ row }) => row.original.cluster ?? '—',
      },
      {
        accessorKey: 'lastLoginAt',
        header: 'Last active',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {relativeTime(row.original.lastLoginAt)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status
          return <StatusChip tone={STATUS_TONE[s.toLowerCase()] ?? 'neutral'} label={s} />
        },
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity · Workforce directory"
        title="Users, roles & delegations"
        description="Every person in the HR directory is listed here, whether or not they have signed in yet. Assign hierarchy-scoped roles (Segregation-of-Duties enforced on the server), review who has access, and suspend or reactivate sign-in accounts."
        action={
          <Button
            variant="secondary"
            disabled={(accessReview.data?.length ?? 0) === 0}
            onClick={() => downloadCsv('access-review.csv', accessReview.data ?? [])}
          >
            <Download className="size-4" aria-hidden="true" /> Export access review
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Employees"
          value={summary.data ? String(summary.data.employees) : '—'}
          icon={Users}
          iconTone="brand"
        />
        <StatCard
          label="Fleet managers"
          value={summary.data ? String(summary.data.fleetManagers) : '—'}
          icon={UserCog}
          iconTone="info"
        />
        <StatCard
          label="Executives"
          value={summary.data ? String(summary.data.executives) : '—'}
          icon={UserCheck}
          iconTone="ok"
        />
        <StatCard
          label="Administrators"
          value={summary.data ? String(summary.data.administrators) : '—'}
          icon={ShieldCheck}
          iconTone="warn"
        />
      </div>

      {users.isError ? (
        <EmptyState title="Could not load users" description="Retry shortly." />
      ) : (
        <DataTable
          columns={columns}
          data={users.data?.items ?? []}
          manual
          total={users.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={users.isLoading}
          search={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search name, email or employee ID…"
          emptyText="No people match the current filters."
          onRowClick={(u) => setTarget(u)}
          toolbar={
            <>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as 'all' | UserStatus)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-11 w-[9.5rem]" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {USER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={roleFilter}
                onValueChange={(v) => {
                  setRoleFilter(v as 'all' | PlatformRole)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-11 w-[11rem]" aria-label="Filter by role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {PLATFORM_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />
      )}

      <ManageUserSheet user={target} onClose={() => setTarget(null)} />
    </div>
  )
}
