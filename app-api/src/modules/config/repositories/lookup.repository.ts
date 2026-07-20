import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { lookupType, lookupValue } from '../../../common/database/schema';

/** Filter/paging options for the admin values grid. */
export interface ListValuesPagedOptions {
  search?: string;
  status?: 'Active' | 'Retiring' | 'Inactive';
  /** Restrict to a parent (id) or top-level (null); omit for all values. */
  parentId?: string | null;
  page: number;
  pageSize: number;
}

/** Data access for the lookup engine (hides Drizzle; enforces active windows). */
@Injectable()
export class LookupRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Finds a lookup type by its stable code, or undefined. */
  async findType(code: string) {
    const rows = await this.db
      .select()
      .from(lookupType)
      .where(eq(lookupType.code, code))
      .limit(1);
    return rows[0];
  }

  /** Finds a lookup type by id, or undefined. */
  async findTypeById(id: string) {
    const rows = await this.db.select().from(lookupType).where(eq(lookupType.id, id)).limit(1);
    return rows[0];
  }

  /** Lists all lookup types (admin catalogue), enriched with the parent type. */
  async listTypes() {
    const parentType = alias(lookupType, 'parent_type');
    return this.db
      .select({
        id: lookupType.id,
        code: lookupType.code,
        labelEn: lookupType.labelEn,
        labelAr: lookupType.labelAr,
        descriptionEn: lookupType.descriptionEn,
        descriptionAr: lookupType.descriptionAr,
        isHierarchical: lookupType.isHierarchical,
        isSystem: lookupType.isSystem,
        parentTypeId: lookupType.parentTypeId,
        parentTypeCode: parentType.code,
        parentTypeLabelEn: parentType.labelEn,
      })
      .from(lookupType)
      .leftJoin(parentType, eq(parentType.id, lookupType.parentTypeId))
      .orderBy(asc(lookupType.code));
  }

  /** Types with their active/total value counts (admin catalogue), incl. parent type. */
  async listTypesWithCounts() {
    const parentType = alias(lookupType, 'parent_type');
    return this.db
      .select({
        id: lookupType.id,
        code: lookupType.code,
        labelEn: lookupType.labelEn,
        labelAr: lookupType.labelAr,
        descriptionEn: lookupType.descriptionEn,
        descriptionAr: lookupType.descriptionAr,
        isHierarchical: lookupType.isHierarchical,
        isSystem: lookupType.isSystem,
        parentTypeId: lookupType.parentTypeId,
        parentTypeCode: parentType.code,
        parentTypeLabelEn: parentType.labelEn,
        totalCount: sql<number>`cast(count(${lookupValue.id}) as int)`,
        activeCount: sql<number>`cast(count(${lookupValue.id}) filter (where ${lookupValue.isActive} = true) as int)`,
      })
      .from(lookupType)
      .leftJoin(lookupValue, eq(lookupValue.lookupTypeId, lookupType.id))
      .leftJoin(parentType, eq(parentType.id, lookupType.parentTypeId))
      .groupBy(lookupType.id, parentType.code, parentType.labelEn)
      .orderBy(asc(lookupType.code));
  }

  /** Child types of a type (their `parent_type_id` points at the given type). */
  async listChildTypes() {
    return this.db
      .select({
        parentTypeId: lookupType.parentTypeId,
        code: lookupType.code,
        labelEn: lookupType.labelEn,
        labelAr: lookupType.labelAr,
      })
      .from(lookupType)
      .where(sql`${lookupType.parentTypeId} is not null`)
      .orderBy(asc(lookupType.code));
  }

  /** Inserts a lookup type and returns it. */
  async insertType(values: typeof lookupType.$inferInsert) {
    const rows = await this.db.insert(lookupType).values(values).returning();
    return rows[0];
  }

  /** Updates a lookup type's mutable fields and returns it. */
  async updateType(id: string, set: Partial<typeof lookupType.$inferInsert>) {
    const rows = await this.db
      .update(lookupType)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(lookupType.id, id))
      .returning();
    return rows[0];
  }

  /** Active values for a type, ordered by sort order (the display order). */
  async listActiveValues(lookupTypeId: string) {
    return this.db
      .select()
      .from(lookupValue)
      .where(and(eq(lookupValue.lookupTypeId, lookupTypeId), eq(lookupValue.isActive, true)))
      .orderBy(asc(lookupValue.sortOrder));
  }

  /** Total values for a type (including inactive). */
  async countValuesByType(lookupTypeId: string): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(lookupValue)
      .where(eq(lookupValue.lookupTypeId, lookupTypeId));
    return Number(rows[0]?.n ?? 0);
  }

  /**
   * Paged, filtered admin view of a type's values (includes inactive). Joins the
   * parent self-reference for parentCode/parentLabelEn and flags hasChildren.
   */
  async listValuesPaged(lookupTypeId: string, opts: ListValuesPagedOptions) {
    const where = this.adminValuesWhere(lookupTypeId, opts);
    const parent = alias(lookupValue, 'parent');
    const items = await this.db
      .select(this.adminValueColumns(parent))
      .from(lookupValue)
      .leftJoin(parent, eq(parent.id, lookupValue.parentId))
      .where(where)
      .orderBy(asc(lookupValue.sortOrder), asc(lookupValue.code))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize);
    const totalRows = await this.db
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(lookupValue)
      .where(where);
    return { items, total: Number(totalRows[0]?.n ?? 0) };
  }

  /** Admin children of a parent value (includes inactive), enriched + ordered. */
  async listChildrenForAdmin(lookupTypeId: string, parentId: string) {
    const parent = alias(lookupValue, 'parent');
    return this.db
      .select(this.adminValueColumns(parent))
      .from(lookupValue)
      .leftJoin(parent, eq(parent.id, lookupValue.parentId))
      .where(and(eq(lookupValue.lookupTypeId, lookupTypeId), eq(lookupValue.parentId, parentId)))
      .orderBy(asc(lookupValue.sortOrder), asc(lookupValue.code));
  }

  /** Finds a value by (type, code), or undefined. */
  async findValueByCode(lookupTypeId: string, code: string) {
    const rows = await this.db
      .select()
      .from(lookupValue)
      .where(and(eq(lookupValue.lookupTypeId, lookupTypeId), eq(lookupValue.code, code)))
      .limit(1);
    return rows[0];
  }

  /**
   * All children of a value ACROSS types (every row whose `parent_id` is the
   * given value id — includes cross-type children like Model values under a
   * Make value, and self-nested same-type children). Each row is enriched with
   * its own type's code/label plus the standard admin columns.
   */
  async listChildrenByValueId(valueId: string) {
    const parent = alias(lookupValue, 'parent');
    return this.db
      .select({
        ...this.adminValueColumns(parent),
        typeCode: lookupType.code,
        typeLabelEn: lookupType.labelEn,
      })
      .from(lookupValue)
      .innerJoin(lookupType, eq(lookupType.id, lookupValue.lookupTypeId))
      .leftJoin(parent, eq(parent.id, lookupValue.parentId))
      .where(eq(lookupValue.parentId, valueId))
      .orderBy(asc(lookupType.code), asc(lookupValue.sortOrder), asc(lookupValue.code));
  }

  /** Finds a value by id, or undefined. */
  async findValueById(id: string) {
    const rows = await this.db.select().from(lookupValue).where(eq(lookupValue.id, id)).limit(1);
    return rows[0];
  }

  /** All values of a type as (id, parentId) pairs — for in-memory cycle/descendant checks. */
  async listValueEdges(lookupTypeId: string) {
    return this.db
      .select({ id: lookupValue.id, parentId: lookupValue.parentId })
      .from(lookupValue)
      .where(eq(lookupValue.lookupTypeId, lookupTypeId));
  }

  /**
   * All values of a type (incl inactive) with their parent's code — the export
   * projection; also feeds import parent resolution.
   */
  async listValuesForExport(lookupTypeId: string) {
    const parent = alias(lookupValue, 'parent');
    return this.db
      .select({
        code: lookupValue.code,
        labelEn: lookupValue.labelEn,
        labelAr: lookupValue.labelAr,
        descriptionEn: lookupValue.descriptionEn,
        descriptionAr: lookupValue.descriptionAr,
        parentCode: parent.code,
        sortOrder: lookupValue.sortOrder,
        isActive: lookupValue.isActive,
        retiring: lookupValue.retiring,
      })
      .from(lookupValue)
      .leftJoin(parent, eq(parent.id, lookupValue.parentId))
      .where(eq(lookupValue.lookupTypeId, lookupTypeId))
      .orderBy(asc(lookupValue.sortOrder), asc(lookupValue.code));
  }

  /** Inserts a value and returns it. */
  async insertValue(values: typeof lookupValue.$inferInsert) {
    const rows = await this.db.insert(lookupValue).values(values).returning();
    return rows[0];
  }

  /** Updates a value's mutable fields and returns it. */
  async updateValue(id: string, set: Partial<typeof lookupValue.$inferInsert>) {
    const rows = await this.db
      .update(lookupValue)
      .set({ ...set, updatedAtUtc: new Date() })
      .where(eq(lookupValue.id, id))
      .returning();
    return rows[0];
  }

  /** Sets an explicit sort order for a value and returns it. */
  async setSortOrder(id: string, sortOrder: number) {
    return this.updateValue(id, { sortOrder });
  }

  /**
   * Moves a value one position up/down among its siblings (same type + parent).
   * Re-indexes the sibling group to sequential sort orders so the move is
   * deterministic even when existing sort orders collide. Returns the moved row.
   */
  async reorderValue(id: string, direction: 'up' | 'down') {
    const current = await this.findValueById(id);
    if (!current) {
      return undefined;
    }
    const siblings = await this.db
      .select({ id: lookupValue.id, sortOrder: lookupValue.sortOrder })
      .from(lookupValue)
      .where(
        and(
          eq(lookupValue.lookupTypeId, current.lookupTypeId),
          current.parentId === null
            ? isNull(lookupValue.parentId)
            : eq(lookupValue.parentId, current.parentId),
        ),
      )
      .orderBy(asc(lookupValue.sortOrder), asc(lookupValue.code));
    const index = siblings.findIndex((s) => s.id === id);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= siblings.length) {
      return current; // already at the edge — no-op
    }
    const ordered = [...siblings];
    [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];
    await this.db.transaction(async (tx) => {
      for (let position = 0; position < ordered.length; position += 1) {
        if (ordered[position].sortOrder !== position) {
          await tx
            .update(lookupValue)
            .set({ sortOrder: position, updatedAtUtc: new Date() })
            .where(eq(lookupValue.id, ordered[position].id));
        }
      }
    });
    return this.findValueById(id);
  }

  /** Shared WHERE for the admin values grid (type + parent + search + status). */
  private adminValuesWhere(lookupTypeId: string, opts: ListValuesPagedOptions) {
    const conditions = [eq(lookupValue.lookupTypeId, lookupTypeId)];
    if (opts.parentId !== undefined) {
      conditions.push(
        opts.parentId === null
          ? isNull(lookupValue.parentId)
          : eq(lookupValue.parentId, opts.parentId),
      );
    }
    if (opts.search) {
      const term = `%${opts.search}%`;
      const match = or(
        ilike(lookupValue.code, term),
        ilike(lookupValue.labelEn, term),
        ilike(lookupValue.labelAr, term),
      );
      if (match) {
        conditions.push(match);
      }
    }
    if (opts.status === 'Inactive') {
      conditions.push(eq(lookupValue.isActive, false));
    } else if (opts.status === 'Retiring') {
      conditions.push(eq(lookupValue.isActive, true), eq(lookupValue.retiring, true));
    } else if (opts.status === 'Active') {
      conditions.push(eq(lookupValue.isActive, true), eq(lookupValue.retiring, false));
    }
    return and(...conditions);
  }

  /** Shared enriched column projection for admin value rows. */
  private adminValueColumns(parent: ReturnType<typeof alias<typeof lookupValue, 'parent'>>) {
    return {
      id: lookupValue.id,
      code: lookupValue.code,
      labelEn: lookupValue.labelEn,
      labelAr: lookupValue.labelAr,
      descriptionEn: lookupValue.descriptionEn,
      descriptionAr: lookupValue.descriptionAr,
      parentId: lookupValue.parentId,
      sortOrder: lookupValue.sortOrder,
      isActive: lookupValue.isActive,
      retiring: lookupValue.retiring,
      parentCode: parent.code,
      parentLabelEn: parent.labelEn,
      hasChildren: sql<boolean>`exists (select 1 from fleet.lookup_value c where c.parent_id = ${lookupValue.id})`,
    };
  }
}
