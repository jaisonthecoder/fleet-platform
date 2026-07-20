import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../platform/services/audit.service';
import type {
  CreateLookupType,
  CreateLookupValue,
  ImportLookup,
  ListLookupValuesQuery,
  LookupChildTypeDto,
  LookupExportRow,
  LookupImportError,
  LookupImportSummary,
  LookupParentOptionDto,
  LookupTypeDto,
  LookupTypeWithCountDto,
  LookupValueAdminDto,
  LookupValueDto,
  LookupValueStatus,
  LookupValueTreeChildDto,
  PagedResult,
  UpdateLookupType,
  UpdateLookupValue,
} from '../../../contracts/lookup.contract';
import { buildLookupTree } from '../internal/lookup-tree';
import { LookupRepository } from '../repositories/lookup.repository';
import { LookupCacheService } from './lookup-cache.service';
import { LookupUsageService } from './lookup-usage.service';

type ValueRow = Awaited<ReturnType<LookupRepository['listActiveValues']>>[number];
type AdminValueRow = Awaited<ReturnType<LookupRepository['listValuesPaged']>>['items'][number];
type TypeRow = Awaited<ReturnType<LookupRepository['findTypeById']>>;

/**
 * Derives the display lifecycle status of a lookup value: an inactive value is
 * `Inactive` regardless of the retiring flag; an active-but-retiring value is
 * `Retiring`; otherwise `Active`.
 */
export function deriveLookupStatus(isActive: boolean, retiring: boolean): LookupValueStatus {
  if (!isActive) {
    return 'Inactive';
  }
  return retiring ? 'Retiring' : 'Active';
}

/**
 * The lookup / reference-data engine (ADR-009). Serves every configurable
 * dropdown as bilingual, code-keyed values (flat or as a cascading tree), and
 * provides governed admin CRUD. Reads are Redis-cached with invalidation on any
 * change. Business logic must reference the stable `code`, never the label.
 */
@Injectable()
export class LookupService {
  constructor(
    private readonly repo: LookupRepository,
    private readonly cache: LookupCacheService,
    private readonly audit: AuditService,
    private readonly usage: LookupUsageService,
  ) {}

  /** Lists the lookup type catalogue. */
  async listTypes(): Promise<LookupTypeDto[]> {
    const types = await this.repo.listTypes();
    return types.map((t) => this.toTypeDto(t));
  }

  /**
   * Admin: the type catalogue with active/total value counts and — for each
   * type — the CHILD TYPES whose `parent_type_id` points at it. `childTypes`
   * (together with `isHierarchical`) drives the value-level "+ Child"
   * affordance and its target-type chooser.
   */
  async listTypesForAdmin(): Promise<LookupTypeWithCountDto[]> {
    const [rows, childTypeRows] = await Promise.all([
      this.repo.listTypesWithCounts(),
      this.repo.listChildTypes(),
    ]);
    const childTypesByParentId = new Map<string, LookupChildTypeDto[]>();
    for (const ct of childTypeRows) {
      if (!ct.parentTypeId) {
        continue;
      }
      const list = childTypesByParentId.get(ct.parentTypeId) ?? [];
      list.push({ code: ct.code, labelEn: ct.labelEn, labelAr: ct.labelAr });
      childTypesByParentId.set(ct.parentTypeId, list);
    }
    return rows.map((t) => ({
      ...this.toTypeDto(t),
      descriptionEn: t.descriptionEn,
      descriptionAr: t.descriptionAr,
      isSystem: t.isSystem,
      activeCount: t.activeCount,
      totalCount: t.totalCount,
      childTypes: childTypesByParentId.get(t.id) ?? [],
    }));
  }

  /** Active values for a type (flat or nested). Cached by type code. */
  async getValues(typeCode: string, tree = false): Promise<LookupValueDto[]> {
    const cached = await this.cache.get(typeCode);
    const flat = cached ?? (await this.loadAndCache(typeCode));
    return tree ? buildLookupTree(flat) : flat;
  }

  /** Cascading children of a parent value within a type. */
  async getChildren(typeCode: string, parentCode: string): Promise<LookupValueDto[]> {
    const flat = await this.getValues(typeCode);
    const parent = flat.find((v) => v.code === parentCode);
    if (!parent) {
      return [];
    }
    return flat.filter((v) => v.parentId === parent.id);
  }

  /**
   * Admin: paged, filtered, enriched values for a type (includes inactive) —
   * with parent code/label, derived status, per-code usage counts, and a
   * has-children flag for cascading types.
   */
  async listValuesForAdmin(
    typeCode: string,
    query: ListLookupValuesQuery,
  ): Promise<PagedResult<LookupValueAdminDto>> {
    const type = await this.requireType(typeCode);
    let parentId: string | undefined;
    if (query.parentCode) {
      const parent = await this.repo.findValueByCode(type.id, query.parentCode);
      if (!parent) {
        return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
      }
      parentId = parent.id;
    }
    const [{ items, total }, usage] = await Promise.all([
      this.repo.listValuesPaged(type.id, {
        search: query.search,
        status: query.status,
        parentId,
        page: query.page,
        pageSize: query.pageSize,
      }),
      this.usage.countsByCode(typeCode),
    ]);
    return {
      items: items.map((row) => this.toAdminDto(row, usage)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * Admin: every child of a value ACROSS types — the cross-type tree children.
   * Returns all values whose `parentId` is `valueId` (Model values under a Make
   * value, plus self-nested same-type children), each enriched with the
   * standard admin fields and tagged with its OWN type's code/label. Usage
   * counts are resolved per distinct child type.
   */
  async listChildrenByValueId(valueId: string): Promise<LookupValueTreeChildDto[]> {
    const rows = await this.repo.listChildrenByValueId(valueId);
    if (rows.length === 0) {
      return [];
    }
    const distinctTypeCodes = [...new Set(rows.map((r) => r.typeCode))];
    const usageByType = new Map<string, Map<string, number>>();
    await Promise.all(
      distinctTypeCodes.map(async (typeCode) => {
        usageByType.set(typeCode, await this.usage.countsByCode(typeCode));
      }),
    );
    return rows.map((row) => ({
      ...this.toAdminDto(row, usageByType.get(row.typeCode) ?? new Map()),
      typeCode: row.typeCode,
      typeLabelEn: row.typeLabelEn,
    }));
  }

  /** Admin: enriched children of a parent value within a type (includes inactive). */
  async listChildrenForAdmin(
    typeCode: string,
    parentCode: string,
  ): Promise<LookupValueAdminDto[]> {
    const type = await this.requireType(typeCode);
    const parent = await this.repo.findValueByCode(type.id, parentCode);
    if (!parent) {
      return [];
    }
    const [rows, usage] = await Promise.all([
      this.repo.listChildrenForAdmin(type.id, parent.id),
      this.usage.countsByCode(typeCode),
    ]);
    return rows.map((row) => this.toAdminDto(row, usage));
  }

  /** Admin: creates a new (non-system) lookup type; audited. */
  async createType(input: CreateLookupType, actorRef = 'system'): Promise<LookupTypeDto> {
    if (await this.repo.findType(input.code)) {
      throw new BadRequestException({
        title: 'Duplicate lookup type',
        reasons: [`lookup-type-exists:${input.code}`],
      });
    }
    const isHierarchical = input.isHierarchical ?? false;
    const parentTypeId = await this.resolveParentTypeId(input.parentTypeCode, input.code);
    this.assertTypeShape(isHierarchical, parentTypeId);
    const row = await this.repo.insertType({
      code: input.code,
      labelEn: input.labelEn,
      labelAr: input.labelAr,
      descriptionEn: input.descriptionEn ?? null,
      descriptionAr: input.descriptionAr ?? null,
      isHierarchical,
      parentTypeId,
      isSystem: false,
    });
    await this.audit.record({
      actorRef,
      action: 'LOOKUP_TYPE_CREATED',
      entityRef: `lookup-type:${input.code}`,
      after: {
        code: input.code,
        labelEn: input.labelEn,
        isHierarchical: row.isHierarchical,
        parentTypeCode: input.parentTypeCode ?? null,
      },
    });
    return this.typeDtoById(row.id);
  }

  /** Admin: updates a non-system lookup type (system types are immutable); audited. */
  async updateType(
    id: string,
    input: UpdateLookupType,
    actorRef = 'system',
  ): Promise<LookupTypeDto> {
    const existing = await this.repo.findTypeById(id);
    if (!existing) {
      throw new NotFoundException({
        title: 'Unknown lookup type',
        reasons: [`lookup-type-not-found:${id}`],
      });
    }
    if (existing.isSystem) {
      throw new BadRequestException({
        title: 'System lookup type is not editable',
        reasons: [`lookup-type-system-locked:${existing.code}`],
      });
    }
    // Resolve the parent type: omitted = unchanged; null/'' = clear.
    let parentTypeId = existing.parentTypeId;
    if (input.parentTypeCode !== undefined) {
      parentTypeId = input.parentTypeCode
        ? await this.resolveParentTypeId(input.parentTypeCode, existing.code)
        : null;
      if (parentTypeId) {
        await this.assertNoTypeCycle(id, parentTypeId);
      }
    }
    const isHierarchical = input.isHierarchical ?? existing.isHierarchical;
    this.assertTypeShape(isHierarchical, parentTypeId);
    const row = await this.repo.updateType(id, {
      labelEn: input.labelEn ?? existing.labelEn,
      labelAr: input.labelAr ?? existing.labelAr,
      descriptionEn: input.descriptionEn ?? existing.descriptionEn,
      descriptionAr: input.descriptionAr ?? existing.descriptionAr,
      isHierarchical,
      parentTypeId,
    });
    await this.audit.record({
      actorRef,
      action: 'LOOKUP_TYPE_UPDATED',
      entityRef: `lookup-type:${existing.code}`,
      before: {
        labelEn: existing.labelEn,
        isHierarchical: existing.isHierarchical,
        parentTypeId: existing.parentTypeId,
      },
      after: { labelEn: row.labelEn, isHierarchical: row.isHierarchical, parentTypeId },
    });
    return this.typeDtoById(id);
  }

  /** Admin: adds a value to a type; invalidates cache; audited. */
  async createValue(
    typeCode: string,
    input: CreateLookupValue,
    actorRef = 'system',
  ): Promise<LookupValueDto> {
    const type = await this.requireType(typeCode);
    if (await this.repo.findValueByCode(type.id, input.code)) {
      throw new BadRequestException({
        title: 'Duplicate lookup value',
        reasons: [`lookup-value-exists:${typeCode}:${input.code}`],
      });
    }
    const parentId = await this.resolveValueParentId(type, input.parentCode);
    const row = await this.repo.insertValue({
      lookupTypeId: type.id,
      code: input.code,
      labelEn: input.labelEn,
      labelAr: input.labelAr,
      descriptionEn: input.descriptionEn ?? null,
      descriptionAr: input.descriptionAr ?? null,
      parentId,
      sortOrder: input.sortOrder ?? 0,
      metadata: input.metadata ?? null,
    });
    await this.cache.invalidate(typeCode);
    await this.audit.record({
      actorRef,
      action: 'LOOKUP_VALUE_CREATED',
      entityRef: `lookup:${typeCode}:${input.code}`,
      after: { code: input.code, labelEn: input.labelEn, labelAr: input.labelAr },
    });
    return this.toDto(row);
  }

  /** Admin: updates a value's labels/order/active/retiring/parent; invalidates cache; audited. */
  async updateValue(
    id: string,
    input: UpdateLookupValue,
    actorRef = 'system',
  ): Promise<LookupValueDto> {
    const existing = await this.repo.findValueById(id);
    if (!existing) {
      throw new NotFoundException({
        title: 'Unknown lookup value',
        reasons: [`lookup-value-not-found:${id}`],
      });
    }
    // Re-parent: omitted = unchanged; null/'' = promote to top level.
    let parentId = existing.parentId;
    if (input.parentCode !== undefined) {
      if (input.parentCode) {
        const type = await this.repo.findTypeById(existing.lookupTypeId);
        if (!type) {
          throw new NotFoundException({
            title: 'Unknown lookup type',
            reasons: [`lookup-type-not-found:${existing.lookupTypeId}`],
          });
        }
        parentId = await this.resolveValueParentId(type, input.parentCode);
        await this.assertNoValueCycle(existing.lookupTypeId, id, parentId);
      } else {
        parentId = null;
      }
    }
    const validTo = input.isActive === false ? new Date() : existing.validTo;
    const row = await this.repo.updateValue(id, {
      labelEn: input.labelEn ?? existing.labelEn,
      labelAr: input.labelAr ?? existing.labelAr,
      descriptionEn: input.descriptionEn ?? existing.descriptionEn,
      descriptionAr: input.descriptionAr ?? existing.descriptionAr,
      parentId,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      isActive: input.isActive ?? existing.isActive,
      retiring: input.retiring ?? existing.retiring,
      metadata: input.metadata === undefined ? existing.metadata : input.metadata,
      validTo,
    });
    const typeCode = await this.typeCodeOf(existing.lookupTypeId);
    await this.cache.invalidate(typeCode);
    await this.audit.record({
      actorRef,
      action: 'LOOKUP_VALUE_UPDATED',
      entityRef: `lookup-value:${id}`,
      before: {
        labelEn: existing.labelEn,
        isActive: existing.isActive,
        retiring: existing.retiring,
        parentId: existing.parentId,
      },
      after: { labelEn: row.labelEn, isActive: row.isActive, retiring: row.retiring, parentId },
    });
    return this.toDto(row);
  }

  /** Admin: deactivates a value (soft-state — sets `is_active=false` + `valid_to`). */
  async deactivateValue(id: string, actorRef = 'system'): Promise<LookupValueDto> {
    return this.updateValue(id, { isActive: false }, actorRef);
  }

  /** Admin: reactivates a deactivated value (clears `valid_to`, sets `is_active=true`). */
  async activateValue(id: string, actorRef = 'system'): Promise<LookupValueDto> {
    const existing = await this.repo.findValueById(id);
    if (!existing) {
      throw new NotFoundException({
        title: 'Unknown lookup value',
        reasons: [`lookup-value-not-found:${id}`],
      });
    }
    const row = await this.repo.updateValue(id, { isActive: true, validTo: null });
    const typeCode = await this.typeCodeOf(existing.lookupTypeId);
    await this.cache.invalidate(typeCode);
    await this.audit.record({
      actorRef,
      action: 'LOOKUP_VALUE_ACTIVATED',
      entityRef: `lookup-value:${id}`,
      before: { isActive: existing.isActive },
      after: { isActive: row.isActive },
    });
    return this.toDto(row);
  }

  /** Admin: moves a value one position up/down among its siblings; invalidates cache; audited. */
  async reorderValue(
    id: string,
    direction: 'up' | 'down',
    actorRef = 'system',
  ): Promise<LookupValueDto> {
    const row = await this.repo.reorderValue(id, direction);
    if (!row) {
      throw new NotFoundException({
        title: 'Unknown lookup value',
        reasons: [`lookup-value-not-found:${id}`],
      });
    }
    const typeCode = await this.typeCodeOf(row.lookupTypeId);
    await this.cache.invalidate(typeCode);
    await this.audit.record({
      actorRef,
      action: 'LOOKUP_VALUE_REORDERED',
      entityRef: `lookup-value:${id}`,
      after: { direction, sortOrder: row.sortOrder },
    });
    return this.toDto(row);
  }

  /**
   * Admin: the candidate parent values for a type's parent selector. For a
   * cascading type (`parentTypeId`) these are the parent type's active values;
   * for a self-hierarchical type they are the type's own active values; a flat
   * type has none.
   */
  async parentOptions(typeCode: string): Promise<LookupParentOptionDto[]> {
    const type = await this.requireType(typeCode);
    if (type.parentTypeId) {
      const parentType = await this.repo.findTypeById(type.parentTypeId);
      if (!parentType) {
        return [];
      }
      const rows = await this.repo.listActiveValues(parentType.id);
      return rows.map((r) => ({
        code: r.code,
        labelEn: r.labelEn,
        labelAr: r.labelAr,
        typeCode: parentType.code,
      }));
    }
    if (type.isHierarchical) {
      const rows = await this.repo.listActiveValues(type.id);
      return rows.map((r) => ({
        code: r.code,
        labelEn: r.labelEn,
        labelAr: r.labelAr,
        typeCode,
      }));
    }
    return [];
  }

  /** Admin: exports every value of a type (round-trips through import). */
  async exportType(typeCode: string): Promise<LookupExportRow[]> {
    const type = await this.requireType(typeCode);
    const rows = await this.repo.listValuesForExport(type.id);
    return rows.map((r) => ({
      code: r.code,
      labelEn: r.labelEn,
      labelAr: r.labelAr,
      descriptionEn: r.descriptionEn,
      descriptionAr: r.descriptionAr,
      parentCode: r.parentCode ?? null,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      retiring: r.retiring,
      status: deriveLookupStatus(r.isActive, r.retiring),
    }));
  }

  /**
   * Admin: bulk upsert of a type's values, keyed by `code`. Parent codes are
   * resolved per the type's parent rules; rows referencing an unknown parent
   * (or otherwise invalid) are skipped and reported. Parent resolution runs in
   * two passes so an imported parent can precede its child. Audited once.
   */
  async importValues(
    typeCode: string,
    input: ImportLookup,
    actorRef = 'system',
  ): Promise<LookupImportSummary> {
    const type = await this.requireType(typeCode);
    const errors: LookupImportError[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Pass 1: upsert labels/descriptions/order (no parent) so every referenced
    // parent exists before pass 2 wires the hierarchy.
    const seen = new Set<string>();
    for (const row of input.rows) {
      if (seen.has(row.code)) {
        errors.push({ code: row.code, reason: 'duplicate-code-in-payload' });
        skipped += 1;
        continue;
      }
      seen.add(row.code);
      try {
        const existing = await this.repo.findValueByCode(type.id, row.code);
        if (existing) {
          await this.repo.updateValue(existing.id, {
            labelEn: row.labelEn,
            labelAr: row.labelAr,
            descriptionEn: row.descriptionEn ?? existing.descriptionEn,
            descriptionAr: row.descriptionAr ?? existing.descriptionAr,
            sortOrder: row.sortOrder ?? existing.sortOrder,
          });
          updated += 1;
        } else {
          await this.repo.insertValue({
            lookupTypeId: type.id,
            code: row.code,
            labelEn: row.labelEn,
            labelAr: row.labelAr,
            descriptionEn: row.descriptionEn ?? null,
            descriptionAr: row.descriptionAr ?? null,
            parentId: null,
            sortOrder: row.sortOrder ?? 0,
            metadata: null,
          });
          created += 1;
        }
      } catch {
        errors.push({ code: row.code, reason: 'write-failed' });
        skipped += 1;
      }
    }

    // Pass 2: resolve + set parents for rows that declared one.
    for (const row of input.rows) {
      if (!row.parentCode) {
        continue;
      }
      try {
        const value = await this.repo.findValueByCode(type.id, row.code);
        if (!value) {
          continue; // failed to upsert in pass 1 — already reported
        }
        const parentId = await this.resolveValueParentId(type, row.parentCode);
        await this.assertNoValueCycle(type.id, value.id, parentId);
        await this.repo.updateValue(value.id, { parentId });
      } catch {
        errors.push({ code: row.code, reason: `parent-unresolved:${row.parentCode}` });
      }
    }

    await this.cache.invalidate(typeCode);
    await this.audit.record({
      actorRef,
      action: 'LOOKUP_VALUES_IMPORTED',
      entityRef: `lookup-type:${typeCode}`,
      after: { created, updated, skipped, errorCount: errors.length },
    });
    return { created, updated, skipped, errors };
  }

  private async loadAndCache(typeCode: string): Promise<LookupValueDto[]> {
    const type = await this.requireType(typeCode);
    const rows = await this.repo.listActiveValues(type.id);
    const dtos = rows.map((r) => this.toDto(r));
    await this.cache.set(typeCode, dtos);
    return dtos;
  }

  private async requireType(typeCode: string) {
    const type = await this.repo.findType(typeCode);
    if (!type) {
      throw new NotFoundException({
        title: 'Unknown lookup type',
        reasons: [`lookup-type-not-found:${typeCode}`],
      });
    }
    return type;
  }

  private async typeCodeOf(typeId: string): Promise<string> {
    const types = await this.repo.listTypes();
    return types.find((t) => t.id === typeId)?.code ?? '';
  }

  /** Maps an enriched (parent-joined) type row to the public DTO. */
  private toTypeDto(row: {
    id: string;
    code: string;
    labelEn: string;
    labelAr: string;
    isHierarchical: boolean;
    parentTypeId: string | null;
    parentTypeCode: string | null;
    parentTypeLabelEn: string | null;
  }): LookupTypeDto {
    return {
      id: row.id,
      code: row.code,
      labelEn: row.labelEn,
      labelAr: row.labelAr,
      isHierarchical: row.isHierarchical,
      parentTypeId: row.parentTypeId,
      parentTypeCode: row.parentTypeCode,
      parentTypeLabelEn: row.parentTypeLabelEn,
    };
  }

  /** Reads one type (parent-joined) as a DTO by id. */
  private async typeDtoById(id: string): Promise<LookupTypeDto> {
    const row = (await this.repo.listTypes()).find((t) => t.id === id);
    if (!row) {
      throw new NotFoundException({
        title: 'Unknown lookup type',
        reasons: [`lookup-type-not-found:${id}`],
      });
    }
    return this.toTypeDto(row);
  }

  /** Resolves a parent type by code, rejecting self-reference and unknown codes. */
  private async resolveParentTypeId(
    parentTypeCode: string | undefined,
    ownCode: string,
  ): Promise<string | null> {
    if (!parentTypeCode) {
      return null;
    }
    if (parentTypeCode === ownCode) {
      throw new BadRequestException({
        title: 'A lookup type cannot be its own parent',
        reasons: [`lookup-type-self-parent:${ownCode}`],
      });
    }
    const parent = await this.repo.findType(parentTypeCode);
    if (!parent) {
      throw new BadRequestException({
        title: 'Unknown parent type',
        reasons: [`lookup-parent-type-not-found:${parentTypeCode}`],
      });
    }
    return parent.id;
  }

  /** A type may be self-hierarchical OR depend on a parent type, never both. */
  private assertTypeShape(isHierarchical: boolean, parentTypeId: string | null): void {
    if (isHierarchical && parentTypeId) {
      throw new BadRequestException({
        title: 'Choose either self-hierarchy or a parent type, not both',
        reasons: ['lookup-type-shape-conflict'],
      });
    }
  }

  /** Rejects a parent-type assignment that would create a cycle (A→B→A). */
  private async assertNoTypeCycle(typeId: string, parentTypeId: string): Promise<void> {
    const types = await this.repo.listTypes();
    const byId = new Map(types.map((t) => [t.id, t]));
    let cursor: string | null = parentTypeId;
    const guard = new Set<string>();
    while (cursor) {
      if (cursor === typeId) {
        throw new BadRequestException({
          title: 'Parent type would create a cycle',
          reasons: ['lookup-type-cycle'],
        });
      }
      if (guard.has(cursor)) {
        break; // pre-existing cycle elsewhere — stop walking
      }
      guard.add(cursor);
      cursor = byId.get(cursor)?.parentTypeId ?? null;
    }
  }

  /**
   * Resolves a value's parent id per its type's parent rules: cascading types
   * resolve against the parent type; self-hierarchical types against the same
   * type; flat types reject any parent.
   */
  private async resolveValueParentId(
    type: NonNullable<TypeRow>,
    parentCode: string | undefined,
  ): Promise<string | null> {
    if (!parentCode) {
      return null;
    }
    const parentTypeId = type.parentTypeId ?? (type.isHierarchical ? type.id : null);
    if (!parentTypeId) {
      throw new BadRequestException({
        title: 'This lookup type does not take a parent value',
        reasons: [`lookup-type-flat:${type.code}`],
      });
    }
    const parent = await this.repo.findValueByCode(parentTypeId, parentCode);
    if (!parent) {
      throw new BadRequestException({
        title: 'Unknown parent value',
        reasons: [`lookup-parent-not-found:${type.code}:${parentCode}`],
      });
    }
    return parent.id;
  }

  /**
   * Rejects a re-parent that points a value at itself or one of its own
   * descendants (self-hierarchical types). Cross-type parents cannot cycle.
   */
  private async assertNoValueCycle(
    lookupTypeId: string,
    valueId: string,
    parentId: string | null,
  ): Promise<void> {
    if (!parentId) {
      return;
    }
    if (parentId === valueId) {
      throw new BadRequestException({
        title: 'A value cannot be its own parent',
        reasons: ['lookup-value-self-parent'],
      });
    }
    const edges = await this.repo.listValueEdges(lookupTypeId);
    // If parent lives in a different type, no same-type cycle is possible.
    if (!edges.some((e) => e.id === parentId)) {
      return;
    }
    const childrenOf = new Map<string, string[]>();
    for (const e of edges) {
      if (e.parentId) {
        const list = childrenOf.get(e.parentId) ?? [];
        list.push(e.id);
        childrenOf.set(e.parentId, list);
      }
    }
    // Walk the subtree rooted at valueId; if we reach the requested parent it
    // is a descendant → cycle.
    const stack = [valueId];
    const visited = new Set<string>();
    while (stack.length) {
      const node = stack.pop() as string;
      if (node === parentId) {
        throw new BadRequestException({
          title: 'Parent would create a cycle (cannot move under a descendant)',
          reasons: ['lookup-value-cycle'],
        });
      }
      if (visited.has(node)) {
        continue;
      }
      visited.add(node);
      for (const child of childrenOf.get(node) ?? []) {
        stack.push(child);
      }
    }
  }

  private toAdminDto(row: AdminValueRow, usage: Map<string, number>): LookupValueAdminDto {
    return {
      id: row.id,
      code: row.code,
      labelEn: row.labelEn,
      labelAr: row.labelAr,
      descriptionEn: row.descriptionEn,
      descriptionAr: row.descriptionAr,
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      retiring: row.retiring,
      status: deriveLookupStatus(row.isActive, row.retiring),
      parentCode: row.parentCode ?? null,
      parentLabelEn: row.parentLabelEn ?? null,
      usageCount: usage.get(row.code) ?? 0,
      hasChildren: Boolean(row.hasChildren),
    };
  }

  private toDto(row: ValueRow): LookupValueDto {
    return {
      id: row.id,
      code: row.code,
      labelEn: row.labelEn,
      labelAr: row.labelAr,
      descriptionEn: row.descriptionEn,
      descriptionAr: row.descriptionAr,
      parentId: row.parentId,
      sortOrder: row.sortOrder,
    };
  }
}
