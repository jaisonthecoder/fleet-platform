import { useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { ColumnDef, Row } from '@tanstack/react-table'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Upload,
} from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { DataTable } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/form/form'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { StatusChip } from '@/components/ui/status-chip'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/patterns/empty-state'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/hooks/use-confirm'
import { notify } from '@/hooks/use-toast'
import { ApiRequestError } from '@/lib/api-client'
import {
  createLookupTypeSchema,
  exportLookupType,
  type LookupImportRow,
  type LookupTypeWithCount,
  type LookupValueAdmin,
  type LookupValueStatus,
  type LookupValueTreeChild,
} from './config.contract'
import {
  useActivateLookupValue,
  useCreateLookupType,
  useCreateLookupValue,
  useDeactivateLookupValue,
  useImportLookupValues,
  useLookupParentOptions,
  useLookupTypesWithCounts,
  useLookupValueChildren,
  useLookupValuesAdmin,
  useReorderLookupValue,
  useUpdateLookupType,
  useUpdateLookupValue,
} from './hooks/use-lookups'

/** Surfaces an ApiRequestError (RFC-7807 title + reasons) as a danger toast. */
function reportError(error: unknown, fallback: string): void {
  if (error instanceof ApiRequestError) {
    notify.danger(error.message || fallback, { description: error.reasons?.join(' · ') })
  } else {
    notify.danger(fallback)
  }
}

const STATUS_TONE: Record<LookupValueStatus, 'ok' | 'warn' | 'neutral'> = {
  Active: 'ok',
  Retiring: 'warn',
  Inactive: 'neutral',
}

const STATUS_FILTERS = ['all', 'Active', 'Retiring', 'Inactive'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const PAGE_SIZE = 25

/** Whether a type accepts a parent value (cascading parent type OR self-nesting). */
function typeTakesParent(type: LookupTypeWithCount | null): boolean {
  return Boolean(type && (type.parentTypeId || type.isHierarchical))
}

/**
 * Whether a value of this type can take a CHILD value: either the type nests its
 * own values (`isHierarchical`) or another type declares it as a parent type
 * (`childTypes`). Drives the "+ Child" affordance.
 */
function typeCanNest(type: LookupTypeWithCount | null | undefined): boolean {
  return Boolean(type && (type.isHierarchical || (type.childTypes?.length ?? 0) > 0))
}

/** A target type a child can be created in when adding a child under a value. */
interface ChildTypeOption {
  typeCode: string
  typeLabel: string
  /** True for the self-nest option (a child in the same list). */
  selfNest: boolean
}

/**
 * The child-type options for a value's type: every declared child TYPE, plus a
 * "same list" self-nest option when the type is hierarchical.
 */
function childTypeOptionsFor(
  type: LookupTypeWithCount | null | undefined,
): ChildTypeOption[] {
  if (!type) return []
  const options: ChildTypeOption[] = (type.childTypes ?? []).map((ct) => ({
    typeCode: ct.code,
    typeLabel: ct.labelEn,
    selfNest: false,
  }))
  if (type.isHierarchical) {
    options.push({ typeCode: type.code, typeLabel: type.labelEn, selfNest: true })
  }
  return options
}

/** Actions shared by the grid rows and the recursive tree nodes. */
interface ValueActions {
  /** Add a child under `parentValue`; the child is created in `childTypeCode`. */
  onAddChild: (
    parentValue: LookupValueAdmin,
    parentTypeCode: string,
    childTypeCode: string,
  ) => void
  onEdit: (value: LookupValueAdmin, typeCode: string) => void
  onToggleRetiring: (value: LookupValueAdmin) => void
  onActivate: (value: LookupValueAdmin) => void
  onDeactivate: (value: LookupValueAdmin) => void
  onReorder: (value: LookupValueAdmin, direction: 'up' | 'down') => void
  reorderPending: boolean
}

// ── Value add/edit form (right Sheet) ───────────────────────────────────────

const valueFormSchema = z.object({
  code: z.string().trim().min(1, 'Code is required'),
  labelEn: z.string().trim().min(1, 'English label is required'),
  labelAr: z.string().trim().min(1, 'Arabic label is required'),
  descriptionEn: z.string().trim().optional(),
  descriptionAr: z.string().trim().optional(),
  parentCode: z.string().trim().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  retiring: z.boolean().optional(),
  metadataText: z.string().optional(),
})
type ValueFormValues = z.input<typeof valueFormSchema>

interface ValueSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  typeCode: string
  /** Human label for the lookup type (e.g. "Ownership Type"). */
  typeLabel: string
  /** Whether this type accepts a parent value (cascading or self-nesting). */
  takesParent: boolean
  /** Label describing the parent domain (parent type label, or the type itself). */
  parentDomainLabel: string
  /** The value being edited, or null for add mode. */
  editing: LookupValueAdmin | null
  /** Pre-selected + locked parent code (Add child from a parent row). */
  lockedParentCode?: string | null
  /** The type label of the locked parent value (e.g. "Vehicle make"). */
  lockedParentTypeLabel?: string | null
  /** Candidate parent values ({ value: code, label }). */
  parentOptions: { value: string; label: string }[]
}

function ValueSheet({
  open,
  onOpenChange,
  typeCode,
  typeLabel,
  takesParent,
  parentDomainLabel,
  editing,
  lockedParentCode,
  lockedParentTypeLabel,
  parentOptions,
}: ValueSheetProps) {
  const createValue = useCreateLookupValue(typeCode)
  const updateValue = useUpdateLookupValue(typeCode)
  const isEdit = editing !== null
  const [showAdvanced, setShowAdvanced] = useState(false)

  const form = useForm<ValueFormValues>({
    resolver: zodResolver(valueFormSchema),
    defaultValues: {
      code: '',
      labelEn: '',
      labelAr: '',
      descriptionEn: '',
      descriptionAr: '',
      parentCode: '',
      sortOrder: 0,
      retiring: false,
      metadataText: '',
    },
  })

  // Reset the form each time the sheet opens for a new target.
  useEffect(() => {
    if (!open) return
    setShowAdvanced(false)
    form.reset({
      code: editing?.code ?? '',
      labelEn: editing?.labelEn ?? '',
      labelAr: editing?.labelAr ?? '',
      descriptionEn: editing?.descriptionEn ?? '',
      descriptionAr: editing?.descriptionAr ?? '',
      parentCode: editing?.parentCode ?? lockedParentCode ?? '',
      sortOrder: editing?.sortOrder ?? 0,
      retiring: editing?.retiring ?? false,
      metadataText: '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, lockedParentCode, typeCode])

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = valueFormSchema.parse(raw)
    let metadata: Record<string, unknown> | null | undefined
    if (showAdvanced) {
      const text = (values.metadataText ?? '').trim()
      if (text.length === 0) {
        metadata = null
      } else {
        try {
          metadata = JSON.parse(text) as Record<string, unknown>
        } catch {
          form.setError('metadataText', { message: 'Metadata must be valid JSON' })
          return
        }
      }
    }
    try {
      if (isEdit && editing) {
        await updateValue.mutateAsync({
          id: editing.id,
          body: {
            labelEn: values.labelEn,
            labelAr: values.labelAr,
            descriptionEn: values.descriptionEn || undefined,
            descriptionAr: values.descriptionAr || undefined,
            sortOrder: values.sortOrder,
            retiring: values.retiring,
            ...(takesParent ? { parentCode: values.parentCode ? values.parentCode : null } : {}),
            ...(showAdvanced ? { metadata } : {}),
          },
        })
        notify.ok(`Updated ${editing.code}`)
      } else {
        await createValue.mutateAsync({
          code: values.code,
          labelEn: values.labelEn,
          labelAr: values.labelAr,
          descriptionEn: values.descriptionEn || undefined,
          descriptionAr: values.descriptionAr || undefined,
          parentCode: takesParent && values.parentCode ? values.parentCode : undefined,
          sortOrder: values.sortOrder,
          ...(showAdvanced && metadata ? { metadata } : {}),
        })
        notify.ok(`Added ${values.code}`)
      }
      onOpenChange(false)
    } catch (error) {
      reportError(error, isEdit ? 'Could not update the value' : 'Could not add the value')
    }
  })

  const pending = createValue.isPending || updateValue.isPending
  const parentLocked = Boolean(lockedParentCode) && !isEdit
  // Prepend an explicit clear option (promote to top level) and exclude the
  // value being edited from its own parent options (self-hierarchy).
  const options = useMemo(
    () => [
      { value: '', label: 'No parent (top level)' },
      ...parentOptions.filter((o) => o.value !== editing?.code),
    ],
    [parentOptions, editing?.code],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-lg">
        <div className="border-b border-border px-6 py-5">
          <p className="eyebrow mb-1">Reference data · {typeLabel}</p>
          <SheetTitle className="text-lg font-bold">
            {isEdit ? `Edit ${editing?.code}` : parentLocked ? 'Add child value' : 'Add value'}
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            {isEdit
              ? 'The code is immutable — historical records key on it. Labels, order, parent and lifecycle can change.'
              : 'Business logic keys on the stable code, never the label. Both languages are required.'}
          </SheetDescription>
        </div>

        <Form {...form}>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="space-y-1.5">
                <span className="text-sm font-medium leading-none">Type</span>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 opacity-90">
                  <span className="text-sm font-medium text-foreground">{typeLabel}</span>
                  <span className="font-data text-xs text-muted-foreground">{typeCode}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {parentLocked
                    ? `New ${typeLabel} value, created under the parent below.`
                    : 'You are managing values within this lookup type. It cannot be changed here.'}
                </p>
              </div>

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly={isEdit}
                        placeholder="e.g. SEDAN"
                        className={cn('font-data uppercase', isEdit && 'opacity-70')}
                      />
                    </FormControl>
                    {isEdit ? <FormDescription>Immutable.</FormDescription> : <FormMessage />}
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="labelEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label (EN)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="labelAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label (AR)</FormLabel>
                      <FormControl>
                        <Input {...field} dir="rtl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="descriptionEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (EN)</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="descriptionAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (AR)</FormLabel>
                      <FormControl>
                        <Textarea {...field} dir="rtl" rows={2} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {takesParent ? (
                <FormField
                  control={form.control}
                  name="parentCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent value</FormLabel>
                      <FormControl>
                        {parentLocked ? (
                          <div className="flex h-11 items-center gap-2 rounded-[3px] border border-input bg-muted px-3.5 text-sm text-muted-foreground">
                            <Lock className="size-3.5" aria-hidden="true" />
                            <span className="font-data">{field.value}</span>
                            {lockedParentTypeLabel ? (
                              <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] uppercase">
                                {lockedParentTypeLabel}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <Combobox
                            options={options}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="No parent (top level)"
                          />
                        )}
                      </FormControl>
                      <FormDescription>
                        {parentLocked
                          ? `Locked to the ${lockedParentTypeLabel ?? 'parent'} value you added this child under.`
                          : `Choose a parent from ${parentDomainLabel}, or leave empty for top level.`}
                      </FormDescription>
                    </FormItem>
                  )}
                />
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={field.value ?? 0}
                          onChange={(e) =>
                            field.onChange(
                              Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber,
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {isEdit ? (
                  <FormField
                    control={form.control}
                    name="retiring"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retiring</FormLabel>
                        <div className="flex h-11 items-center gap-3">
                          <Switch
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                            aria-label="Mark this value as retiring"
                          />
                          <span className="text-sm text-muted-foreground">
                            Still selectable, flagged for phase-out.
                          </span>
                        </div>
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>

              {isEdit && editing ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[3px] border border-border bg-surface-2/40 px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">Used by</dt>
                  <dd className="font-data">
                    {editing.usageCount == null ? '—' : `${editing.usageCount} record(s)`}
                  </dd>
                  <dt className="text-muted-foreground">Parent path</dt>
                  <dd className="font-data">
                    {editing.parentLabelEn
                      ? `${editing.parentLabelEn} › ${editing.labelEn}`
                      : editing.labelEn}
                  </dd>
                  <dt className="text-muted-foreground">Lifecycle</dt>
                  <dd>
                    <StatusChip tone={STATUS_TONE[editing.status]} label={editing.status} />
                  </dd>
                </dl>
              ) : null}

              <div className="rounded-[3px] border border-border">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  aria-expanded={showAdvanced}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
                >
                  <span>Advanced — metadata (JSON)</span>
                  {showAdvanced ? (
                    <ChevronDown className="size-4" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                  )}
                </button>
                {showAdvanced ? (
                  <div className="border-t border-border px-4 py-3">
                    <FormField
                      control={form.control}
                      name="metadataText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Metadata</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={4}
                              className="font-data text-xs"
                              placeholder='{ "colour": "#0B3D5C" }'
                            />
                          </FormControl>
                          <FormDescription>
                            Optional structured attributes. Leave empty to clear.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <SheetClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add value'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

// ── Type add/edit form (right Sheet) ────────────────────────────────────────

const typeFormSchema = createLookupTypeSchema
type TypeFormValues = z.input<typeof typeFormSchema>

interface TypeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: LookupTypeWithCount | null
  /** All types (for the parent-type selector); excludes self at render. */
  allTypes: LookupTypeWithCount[]
}

function TypeSheet({ open, onOpenChange, editing, allTypes }: TypeSheetProps) {
  const createType = useCreateLookupType()
  const updateType = useUpdateLookupType()
  const isEdit = editing !== null

  const form = useForm<TypeFormValues>({
    resolver: zodResolver(typeFormSchema),
    defaultValues: {
      code: '',
      labelEn: '',
      labelAr: '',
      descriptionEn: '',
      descriptionAr: '',
      isHierarchical: false,
      parentTypeCode: '',
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      code: editing?.code ?? '',
      labelEn: editing?.labelEn ?? '',
      labelAr: editing?.labelAr ?? '',
      descriptionEn: editing?.descriptionEn ?? '',
      descriptionAr: editing?.descriptionAr ?? '',
      isHierarchical: editing?.isHierarchical ?? false,
      parentTypeCode: editing?.parentTypeCode ?? '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  const isHierarchical = form.watch('isHierarchical')
  const parentTypeCode = form.watch('parentTypeCode')

  const parentTypeOptions = useMemo(
    () =>
      allTypes
        .filter((t) => t.code !== editing?.code)
        .map((t) => ({ value: t.code, label: `${t.labelEn} · ${t.code}` })),
    [allTypes, editing?.code],
  )

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = typeFormSchema.parse(raw)
    try {
      if (isEdit && editing) {
        await updateType.mutateAsync({
          id: editing.id,
          body: {
            labelEn: values.labelEn,
            labelAr: values.labelAr,
            descriptionEn: values.descriptionEn || undefined,
            descriptionAr: values.descriptionAr || undefined,
            isHierarchical: values.isHierarchical,
            parentTypeCode: values.parentTypeCode ? values.parentTypeCode : null,
          },
        })
        notify.ok(`Updated ${editing.code}`)
      } else {
        await createType.mutateAsync({
          code: values.code,
          labelEn: values.labelEn,
          labelAr: values.labelAr,
          descriptionEn: values.descriptionEn || undefined,
          descriptionAr: values.descriptionAr || undefined,
          isHierarchical: values.isHierarchical,
          parentTypeCode: values.parentTypeCode || undefined,
        })
        notify.ok(`Created ${values.code}`)
      }
      onOpenChange(false)
    } catch (error) {
      reportError(error, isEdit ? 'Could not update the type' : 'Could not create the type')
    }
  })

  const pending = createType.isPending || updateType.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <div className="border-b border-border px-6 py-5">
          <p className="eyebrow mb-1">Reference data · Master tables</p>
          <SheetTitle className="text-lg font-bold">
            {isEdit ? `Edit ${editing?.code}` : 'New lookup type'}
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            {isEdit
              ? 'Rename or re-flag this list domain. The code is immutable.'
              : 'Create a new configurable list domain. System types cannot be created here.'}
          </SheetDescription>
        </div>

        <Form {...form}>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly={isEdit}
                        placeholder="e.g. cost-centre"
                        className={cn('font-data', isEdit && 'opacity-70')}
                      />
                    </FormControl>
                    {isEdit ? <FormDescription>Immutable.</FormDescription> : <FormMessage />}
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="labelEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label (EN)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="labelAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label (AR)</FormLabel>
                      <FormControl>
                        <Input {...field} dir="rtl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Hierarchy</p>
                <p className="text-xs text-muted-foreground">
                  A type is flat, OR nests its own values, OR depends on a parent type — pick at
                  most one.
                </p>
              </div>

              <FormField
                control={form.control}
                name="isHierarchical"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Self-nesting (e.g. Make → Model in one list)</FormLabel>
                    <div className="flex h-11 items-center gap-3">
                      <Switch
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                        disabled={Boolean(parentTypeCode)}
                        aria-label="Values in this type nest under a parent value of the same type"
                      />
                      <span className="text-sm text-muted-foreground">
                        {parentTypeCode
                          ? 'Disabled — a parent type is set.'
                          : 'Values nest under a parent value within this same type.'}
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentTypeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent type (cascading / dependent lookup)</FormLabel>
                    <FormControl>
                      <Combobox
                        options={parentTypeOptions}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="No parent type (flat or self-nesting)"
                        disabled={Boolean(isHierarchical)}
                      />
                    </FormControl>
                    <FormDescription>
                      {isHierarchical
                        ? 'Disabled — self-nesting is on.'
                        : 'Each value links to a value of the chosen parent type (e.g. Vehicle Model → Vehicle Make).'}
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <SheetClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create type'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

// ── Import (right Sheet) ────────────────────────────────────────────────────

/** Parses pasted/loaded text as a lookup import (JSON array/object or CSV). */
function parseImport(text: string): { rows: LookupImportRow[]; error?: string } {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { rows: [], error: 'Nothing to import.' }
  // JSON: an array of rows or an object with a `rows` array.
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const arr = Array.isArray(parsed) ? parsed : ((parsed as { rows?: unknown }).rows ?? [])
      if (!Array.isArray(arr)) return { rows: [], error: 'JSON must be an array of rows.' }
      return { rows: arr as LookupImportRow[] }
    } catch {
      return { rows: [], error: 'Invalid JSON.' }
    }
  }
  // CSV: header line then rows. Supports simple double-quoted fields.
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2)
    return { rows: [], error: 'CSV needs a header row and at least one data row.' }
  const header = splitCsvLine(lines[0]).map((h) => h.trim())
  const rows: LookupImportRow[] = []
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i])
    const rec: Record<string, string> = {}
    header.forEach((key, idx) => {
      rec[key] = (cells[idx] ?? '').trim()
    })
    if (!rec.code) continue
    rows.push({
      code: rec.code,
      labelEn: rec.labelEn ?? '',
      labelAr: rec.labelAr ?? '',
      descriptionEn: rec.descriptionEn || undefined,
      descriptionAr: rec.descriptionAr || undefined,
      parentCode: rec.parentCode || undefined,
      sortOrder: rec.sortOrder ? Number(rec.sortOrder) : undefined,
    })
  }
  return { rows }
}

/** Splits one CSV line honouring double-quoted fields with escaped quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

interface ImportSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  typeCode: string
}

function ImportSheet({ open, onOpenChange, typeCode }: ImportSheetProps) {
  const importValues = useImportLookupValues(typeCode)
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) setText('')
  }, [open])

  const preview = useMemo(() => parseImport(text), [text])

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setText(await file.text())
  }

  const onImport = async (): Promise<void> => {
    if (preview.error || preview.rows.length === 0) {
      notify.warn(preview.error ?? 'Nothing to import.')
      return
    }
    try {
      const summary = await importValues.mutateAsync(preview.rows)
      notify.ok(`Imported ${typeCode}`, {
        description: `${summary.created} created · ${summary.updated} updated · ${summary.skipped} skipped · ${summary.errors.length} error(s)`,
      })
      if (summary.errors.length > 0) {
        notify.warn('Some rows had errors', {
          description: summary.errors
            .slice(0, 5)
            .map((e) => `${e.code}: ${e.reason}`)
            .join(' · '),
        })
      }
      onOpenChange(false)
    } catch (error) {
      reportError(error, 'Import failed')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-lg">
        <div className="border-b border-border px-6 py-5">
          <p className="eyebrow mb-1">Reference data · {typeCode}</p>
          <SheetTitle className="text-lg font-bold">Import values</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            Paste JSON or CSV, or upload a file. Rows upsert by code. CSV header:{' '}
            <span className="font-data">
              code,labelEn,labelAr,descriptionEn,descriptionAr,parentCode,sortOrder
            </span>
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" /> Upload file
            </Button>
            <span className="text-sm text-muted-foreground">or paste below</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="font-data text-xs"
            aria-label="Import data (JSON or CSV)"
            placeholder='[ { "code": "SEDAN", "labelEn": "Sedan", "labelAr": "سيدان" } ]'
          />
          <div className="rounded-[3px] border border-border bg-surface-2/40 px-4 py-3 text-sm">
            {preview.error ? (
              <span className="text-destructive" role="alert">
                {preview.error}
              </span>
            ) : (
              <span className="text-muted-foreground">
                <span className="font-data text-foreground">{preview.rows.length}</span> row(s)
                ready to import.
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <SheetClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="button"
            onClick={() => void onImport()}
            disabled={
              importValues.isPending || preview.rows.length === 0 || Boolean(preview.error)
            }
          >
            {importValues.isPending ? 'Importing…' : `Import ${preview.rows.length} row(s)`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Row action menu (shared by grid rows + tree nodes) ──────────────────────

function ValueActionMenu({
  value,
  typeCode,
  actions,
}: {
  value: LookupValueAdmin
  typeCode: string
  actions: ValueActions
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Actions for ${value.code}`}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => actions.onEdit(value, typeCode)}>
          <Pencil className="size-4" aria-hidden="true" /> Edit / move
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.onToggleRetiring(value)}>
          {value.retiring ? 'Clear retiring' : 'Mark retiring'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {value.isActive ? (
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => actions.onDeactivate(value)}
          >
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => actions.onActivate(value)}>Activate</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Add-child control (child-TYPE-driven nesting) ───────────────────────────

/**
 * The "+ Child" affordance for a value. Shown only when the value's type can
 * nest (has child TYPES or is self-hierarchical). One target type → a direct
 * button; several → a compact chooser so the user picks WHICH type the child is
 * created in (e.g. "Model", or "Vehicle make (same list)" for self-nesting).
 */
function AddChildControl({
  value,
  type,
  actions,
  variant = 'ghost',
}: {
  value: LookupValueAdmin
  type: LookupTypeWithCount | undefined
  actions: ValueActions
  variant?: 'ghost' | 'secondary'
}) {
  const options = childTypeOptionsFor(type)
  if (!type || options.length === 0) return null
  if (options.length === 1) {
    const opt = options[0]
    return (
      <Button
        size="sm"
        variant={variant}
        onClick={() => actions.onAddChild(value, type.code, opt.typeCode)}
        aria-label={`Add ${opt.typeLabel} under ${value.code}`}
      >
        <Plus className="size-4" aria-hidden="true" /> Child
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={variant} aria-label={`Add child under ${value.code}`}>
          <Plus className="size-4" aria-hidden="true" /> Child
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Add child in…</DropdownMenuLabel>
        {options.map((opt) => (
          <DropdownMenuItem
            key={`${opt.typeCode}:${opt.selfNest ? 'self' : 'cross'}`}
            onSelect={() => actions.onAddChild(value, type.code, opt.typeCode)}
          >
            {opt.selfNest ? `${opt.typeLabel} (same list)` : opt.typeLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Recursive tree node (arbitrary depth, cross-type: Make → Model → Trim …) ─

interface TreeNodeProps {
  value: LookupValueTreeChild
  depth: number
  /** Type catalogue keyed by code — resolves each child's own nesting rules. */
  typesByCode: Map<string, LookupTypeWithCount>
  actions: ValueActions
}

function TreeNode({ value, depth, typesByCode, actions }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const children = useLookupValueChildren(value.id, expanded && value.hasChildren)
  const ownType = typesByCode.get(value.typeCode)

  return (
    <li>
      <div
        className="flex items-center justify-between gap-3 px-3 py-2"
        style={{ paddingInlineStart: `${0.75 + depth * 1.25}rem` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {value.hasChildren ? (
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? `Collapse ${value.code}` : `Expand ${value.code}`}
            >
              {expanded ? (
                <ChevronDown className="size-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
              )}
            </Button>
          ) : (
            <span className="inline-block size-6" aria-hidden="true" />
          )}
          <span className="font-data text-xs text-muted-foreground">{value.code}</span>
          <span className="truncate text-sm font-medium">{value.labelEn}</span>
          <span className="truncate text-sm text-muted-foreground" dir="rtl">
            {value.labelAr}
          </span>
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {value.typeLabelEn}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusChip tone={STATUS_TONE[value.status]} label={value.status} />
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={actions.reorderPending}
            onClick={() => actions.onReorder(value, 'up')}
            aria-label={`Move ${value.code} up`}
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={actions.reorderPending}
            onClick={() => actions.onReorder(value, 'down')}
            aria-label={`Move ${value.code} down`}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
          <AddChildControl value={value} type={ownType} actions={actions} />
          <ValueActionMenu value={value} typeCode={value.typeCode} actions={actions} />
        </div>
      </div>
      {expanded && value.hasChildren ? (
        <ul className="border-t border-border">
          {children.isLoading ? (
            <li className="px-6 py-2 text-sm text-muted-foreground">Loading children…</li>
          ) : (children.data?.length ?? 0) === 0 ? (
            <li className="px-6 py-2 text-sm text-muted-foreground">No child values yet.</li>
          ) : (
            children.data?.map((child) => (
              <TreeNode
                key={child.id}
                value={child}
                depth={depth + 1}
                typesByCode={typesByCode}
                actions={actions}
              />
            ))
          )}
        </ul>
      ) : null}
    </li>
  )
}

// ── Expanded parent row content (cross-type children by value id) ───────────

interface ChildrenSubRowProps {
  parentValue: LookupValueAdmin
  parentType: LookupTypeWithCount | undefined
  typesByCode: Map<string, LookupTypeWithCount>
  actions: ValueActions
}

function ChildrenSubRow({ parentValue, parentType, typesByCode, actions }: ChildrenSubRowProps) {
  const children = useLookupValueChildren(parentValue.id, true)
  return (
    <div className="space-y-2 px-6 py-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Children of {parentValue.code}</p>
        <AddChildControl
          value={parentValue}
          type={parentType}
          actions={actions}
          variant="secondary"
        />
      </div>
      {children.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading children…</p>
      ) : (children.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No child values yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-[3px] border border-border bg-card">
          {children.data?.map((child) => (
            <TreeNode
              key={child.id}
              value={child}
              depth={0}
              typesByCode={typesByCode}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Reference-data (lookup) management — `/{lang}/admin/reference-data`.
 * A selectable catalogue of list domains (left), then a server-paged, filtered,
 * bilingual value grid (right). Types can self-nest (Make→Model→Trim) or depend
 * on a PARENT TYPE (cascading, e.g. Vehicle Model → Vehicle Make); values can be
 * re-parented, activated/deactivated, bulk imported/exported, and carry
 * metadata. All create/edit/import flows use a right-side Sheet.
 */
export function ReferenceDataPage() {
  const types = useLookupTypesWithCounts()
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const activeType = useMemo<LookupTypeWithCount | null>(() => {
    const list = types.data ?? []
    return list.find((t) => t.code === selectedCode) ?? list[0] ?? null
  }, [types.data, selectedCode])
  const activeCode = activeType?.code ?? null
  const canNest = typeCanNest(activeType)

  // Type catalogue keyed by code — a cross-type child knows its OWN type, which
  // differs from the grid's active type (child-TYPE-driven nesting).
  const typesByCode = useMemo(() => {
    const map = new Map<string, LookupTypeWithCount>()
    for (const t of types.data ?? []) map.set(t.code, t)
    return map
  }, [types.data])

  // Toolbar / query state (server-driven).
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  // Debounce the search box into the server query; reset to page 1 on change.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(id)
  }, [searchInput])

  const query = useMemo(
    () => ({
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, status, page],
  )
  const values = useLookupValuesAdmin(activeCode, query)

  const confirm = useConfirm()
  const deactivateValue = useDeactivateLookupValue(activeCode ?? '')
  const activateValueMut = useActivateLookupValue(activeCode ?? '')
  const updateValue = useUpdateLookupValue(activeCode ?? '')
  const reorderValue = useReorderLookupValue(activeCode ?? '')

  // Value sheet state — the sheet operates in `sheetTypeCode` (the create target
  // for add/child, or the edited value's own type), which may differ from the
  // grid's active type (child-TYPE-driven nesting).
  const [valueSheetOpen, setValueSheetOpen] = useState(false)
  const [editingValue, setEditingValue] = useState<LookupValueAdmin | null>(null)
  const [lockedParentCode, setLockedParentCode] = useState<string | null>(null)
  const [lockedParentTypeLabel, setLockedParentTypeLabel] = useState<string | null>(null)
  const [sheetTypeCode, setSheetTypeCode] = useState<string | null>(null)
  const [typeSheetOpen, setTypeSheetOpen] = useState(false)
  const [editingType, setEditingType] = useState<LookupTypeWithCount | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const sheetType = sheetTypeCode ? (typesByCode.get(sheetTypeCode) ?? null) : null
  const sheetTypeLabel = sheetType?.labelEn ?? sheetTypeCode ?? ''
  const sheetTakesParent = typeTakesParent(sheetType)
  const sheetParentDomainLabel = sheetType?.parentTypeLabelEn
    ? `${sheetType.parentTypeLabelEn} values`
    : `${sheetType?.labelEn ?? 'this type'} values`

  // Candidate parent values for the sheet's target type (only needed when the
  // parent isn't locked — i.e. plain add / edit, not add-child).
  const parentOptionsQuery = useLookupParentOptions(
    sheetTakesParent && !lockedParentCode ? sheetTypeCode : null,
  )
  const parentOptions = useMemo(
    () =>
      (parentOptionsQuery.data ?? []).map((o) => ({
        value: o.code,
        label: `${o.labelEn} · ${o.code}`,
      })),
    [parentOptionsQuery.data],
  )

  const selectType = (code: string) => {
    setSelectedCode(code)
    setSearchInput('')
    setSearch('')
    setStatus('all')
    setPage(1)
  }

  const openAddValue = () => {
    setEditingValue(null)
    setLockedParentCode(null)
    setLockedParentTypeLabel(null)
    setSheetTypeCode(activeCode)
    setValueSheetOpen(true)
  }
  const openAddChild = (
    parentValue: LookupValueAdmin,
    parentTypeCode: string,
    childTypeCode: string,
  ) => {
    setEditingValue(null)
    setLockedParentCode(parentValue.code)
    setLockedParentTypeLabel(typesByCode.get(parentTypeCode)?.labelEn ?? parentTypeCode)
    setSheetTypeCode(childTypeCode)
    setValueSheetOpen(true)
  }
  const openEditValue = (value: LookupValueAdmin, typeCode: string) => {
    setEditingValue(value)
    setLockedParentCode(null)
    setLockedParentTypeLabel(null)
    setSheetTypeCode(typeCode)
    setValueSheetOpen(true)
  }
  const openNewType = () => {
    setEditingType(null)
    setTypeSheetOpen(true)
  }
  const openEditType = (type: LookupTypeWithCount) => {
    setEditingType(type)
    setTypeSheetOpen(true)
  }

  async function onDeactivate(value: LookupValueAdmin): Promise<void> {
    const ok = await confirm({
      title: `Deactivate "${value.labelEn}"?`,
      description: `Code ${value.code} will be retired (soft-state). Historical records keep it.`,
      confirmLabel: 'Deactivate',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deactivateValue.mutateAsync(value.id)
      notify.ok(`Deactivated ${value.code}`)
    } catch (error) {
      reportError(error, 'Could not deactivate the value')
    }
  }

  async function onActivate(value: LookupValueAdmin): Promise<void> {
    try {
      await activateValueMut.mutateAsync(value.id)
      notify.ok(`Activated ${value.code}`)
    } catch (error) {
      reportError(error, 'Could not activate the value')
    }
  }

  async function onToggleRetiring(value: LookupValueAdmin): Promise<void> {
    try {
      await updateValue.mutateAsync({ id: value.id, body: { retiring: !value.retiring } })
      notify.ok(
        value.retiring ? `Cleared retiring on ${value.code}` : `Marked ${value.code} retiring`,
      )
    } catch (error) {
      reportError(error, 'Could not update the value')
    }
  }

  async function onReorder(value: LookupValueAdmin, direction: 'up' | 'down'): Promise<void> {
    try {
      await reorderValue.mutateAsync({ id: value.id, direction })
    } catch (error) {
      reportError(error, 'Could not reorder the value')
    }
  }

  const actions: ValueActions = {
    onAddChild: openAddChild,
    onEdit: openEditValue,
    onToggleRetiring: (v) => void onToggleRetiring(v),
    onActivate: (v) => void onActivate(v),
    onDeactivate: (v) => void onDeactivate(v),
    onReorder: (v, d) => void onReorder(v, d),
    reorderPending: reorderValue.isPending,
  }

  async function onExport(format: 'json' | 'csv'): Promise<void> {
    if (!activeCode) return
    try {
      const rows = await exportLookupType(activeCode)
      let content: string
      let mime: string
      if (format === 'json') {
        content = JSON.stringify(rows, null, 2)
        mime = 'application/json'
      } else {
        const header = [
          'code',
          'labelEn',
          'labelAr',
          'descriptionEn',
          'descriptionAr',
          'parentCode',
          'sortOrder',
          'status',
        ]
        const esc = (v: unknown) => {
          const s = v == null ? '' : String(v)
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        }
        content = [
          header.join(','),
          ...rows.map((r) =>
            [
              r.code,
              r.labelEn,
              r.labelAr,
              r.descriptionEn,
              r.descriptionAr,
              r.parentCode,
              r.sortOrder,
              r.status,
            ]
              .map(esc)
              .join(','),
          ),
        ].join('\n')
        mime = 'text/csv'
      }
      const blob = new Blob([content], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeCode}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      notify.ok(`Exported ${rows.length} value(s)`)
    } catch (error) {
      reportError(error, 'Could not export values')
    }
  }

  const columns = useMemo<ColumnDef<LookupValueAdmin>[]>(() => {
    const cols: ColumnDef<LookupValueAdmin>[] = []
    if (canNest) {
      cols.push({
        id: 'expander',
        header: '',
        enableSorting: false,
        cell: ({ row }: { row: Row<LookupValueAdmin> }) =>
          row.getCanExpand() ? (
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => row.toggleExpanded()}
              aria-label={row.getIsExpanded() ? 'Collapse children' : 'Expand children'}
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="size-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
              )}
            </Button>
          ) : null,
      })
    }
    cols.push(
      {
        accessorKey: 'code',
        header: 'Code',
        cell: ({ row }) => <span className="font-data text-xs">{row.original.code}</span>,
      },
      {
        accessorKey: 'labelEn',
        header: 'Value',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium">{row.original.labelEn}</div>
            <div className="text-xs text-muted-foreground" dir="rtl">
              {row.original.labelAr}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'parentLabelEn',
        header: 'Parent',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.parentLabelEn ? (
            <span className="text-sm">
              {row.original.parentLabelEn}
              <span className="ms-1 font-data text-xs text-muted-foreground">
                {row.original.parentCode}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'usageCount',
        header: 'Used by',
        cell: ({ row }) => {
          const n = row.original.usageCount
          return n === null || n === undefined ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="font-data text-sm">{n.toLocaleString()} vehicles</span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusChip tone={STATUS_TONE[row.original.status]} label={row.original.status} />
        ),
      },
      {
        id: 'order',
        header: 'Order',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={reorderValue.isPending}
              onClick={() => void onReorder(row.original, 'up')}
              aria-label={`Move ${row.original.code} up`}
            >
              <ChevronUp className="size-4" aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={reorderValue.isPending}
              onClick={() => void onReorder(row.original, 'down')}
              aria-label={`Move ${row.original.code} down`}
            >
              <ChevronDown className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <AddChildControl value={row.original} type={activeType ?? undefined} actions={actions} />
            <ValueActionMenu
              value={row.original}
              typeCode={activeCode ?? ''}
              actions={actions}
            />
          </div>
        ),
      },
    )
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canNest, activeCode, activeType, reorderValue.isPending])

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Left column — type catalogue */}
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Master tables</p>
          <Button size="sm" variant="secondary" onClick={openNewType}>
            <Plus className="size-4" aria-hidden="true" /> New type
          </Button>
        </div>
        {types.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading list domains…</p>
        ) : types.isError ? (
          <EmptyState title="Could not load reference data" description="Retry shortly." />
        ) : (types.data?.length ?? 0) === 0 ? (
          <EmptyState title="No lookup types" description="Create one to begin." />
        ) : (
          <ul className="space-y-1.5">
            {types.data?.map((type) => {
              const isActive = type.code === activeCode
              return (
                <li key={type.code} className="group relative">
                  <button
                    type="button"
                    onClick={() => selectType(type.code)}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[3px] border border-border bg-card px-3 py-2.5 text-start transition-colors hover:bg-surface-hover',
                      isActive && 'border-signal/50 bg-signal/5',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-8 w-[3px] rounded-full',
                        isActive ? 'bg-signal' : 'bg-transparent',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {type.labelEn}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span className="font-data text-xs text-muted-foreground">{type.code}</span>
                        {type.isSystem ? (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            system
                          </span>
                        ) : null}
                        {type.isHierarchical ? (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            self-nested
                          </span>
                        ) : null}
                        {type.parentTypeLabelEn ? (
                          <span className="rounded-full bg-signal/15 px-1.5 py-0.5 text-[10px] uppercase text-signal">
                            child of {type.parentTypeLabelEn}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-data text-xs text-muted-foreground">
                      {type.activeCount}/{type.totalCount}
                    </span>
                  </button>
                  {!type.isSystem ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute end-9 top-1/2 size-7 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                      onClick={() => openEditType(type)}
                      aria-label={`Edit ${type.labelEn} type`}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      {/* Right column — values grid */}
      <section className="min-w-0 space-y-5">
        <PageHeader
          eyebrow="Reference data · Master tables"
          title="Lookup management"
          description={
            activeType
              ? `Managing ${activeType.labelEn} — configurable, bilingual values that populate dropdowns across the platform.`
              : 'Configurable, bilingual lookup lists that populate dropdowns across the platform.'
          }
          action={
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" disabled={!activeCode}>
                    <Download className="size-4" aria-hidden="true" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void onExport('json')}>
                    Export JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void onExport('csv')}>
                    Export CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="secondary" onClick={() => setImportOpen(true)} disabled={!activeCode}>
                <Upload className="size-4" aria-hidden="true" /> Import
              </Button>
              <Button onClick={openAddValue} disabled={!activeCode}>
                <Plus className="size-4" aria-hidden="true" /> Add value
              </Button>
            </div>
          }
        />

        {activeCode ? (
          <DataTable
            columns={columns}
            data={values.data?.items ?? []}
            manual
            total={values.data?.total ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            isLoading={values.isLoading}
            search={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search code or label…"
            emptyText="No values match the current filters."
            getRowCanExpand={canNest ? (row) => row.original.hasChildren : undefined}
            renderSubRow={
              canNest
                ? (row) => (
                    <ChildrenSubRow
                      parentValue={row.original}
                      parentType={activeType ?? undefined}
                      typesByCode={typesByCode}
                      actions={actions}
                    />
                  )
                : undefined
            }
            toolbar={
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as StatusFilter)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-11 w-[9.5rem]" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Retiring">Retiring</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        ) : null}
      </section>

      {activeCode ? (
        <>
          <ValueSheet
            open={valueSheetOpen}
            onOpenChange={setValueSheetOpen}
            typeCode={sheetTypeCode ?? activeCode}
            typeLabel={sheetTypeLabel || (activeType?.labelEn ?? activeCode)}
            takesParent={sheetTakesParent}
            parentDomainLabel={sheetParentDomainLabel}
            editing={editingValue}
            lockedParentCode={lockedParentCode}
            lockedParentTypeLabel={lockedParentTypeLabel}
            parentOptions={parentOptions}
          />
          <ImportSheet open={importOpen} onOpenChange={setImportOpen} typeCode={activeCode} />
        </>
      ) : null}
      <TypeSheet
        open={typeSheetOpen}
        onOpenChange={setTypeSheetOpen}
        editing={editingType}
        allTypes={types.data ?? []}
      />
    </div>
  )
}
