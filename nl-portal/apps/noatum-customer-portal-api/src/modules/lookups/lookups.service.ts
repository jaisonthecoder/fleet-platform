import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { AnalyticsService } from '../../common/analytics/analytics.service';
import type { TenantClient } from '../../common/tenancy/tenant.repository';
import { PERMISSIONS } from '../../contracts/permissions';
import {
  LOOKUP_DEFAULT_LOCALE,
  LOOKUP_LOCALES,
  type LookupCategoryCreate,
  type LookupCategoryDto,
  type LookupCategoryUpdate,
  type LookupItemCreate,
  type LookupItemDto,
  type LookupItemListDto,
  type LookupItemQuery,
  type LookupItemUpdate,
} from '../../contracts/dto/lookup.dto';
import { LookupsRepository } from './lookups.repository';

const withTranslations = {
  translations: true,
  parent: { include: { translations: true } },
} as const;
type ItemRecord = Prisma.LookupItemGetPayload<{ include: typeof withTranslations }>;
type CategoryRecord = Prisma.LookupCategoryGetPayload<{ include: { parentCategory: { select: { code: true } } } }>;

/** Only portal-owned lists accept content edits; the rest are owned elsewhere. */
export const canEditContent = (ownership: string) => ownership === 'portal';

/**
 * Whether a code is used at all is Noatum's decision even when its wording is not, so a
 * source list can be retired here. A system list mirrors an application enum, and
 * retiring one of those would break the code that branches on it.
 */
export const canRetire = (ownership: string) => ownership !== 'system';

/** Prisma wants DbNull rather than null to clear a nullable JSON column. */
const jsonInput = (value: Record<string, unknown> | null | undefined) =>
  value ? (value as Prisma.InputJsonObject) : Prisma.DbNull;

function defaultLabel(translations: { locale: string; label: string }[]) {
  return (
    translations.find((entry) => entry.locale === LOOKUP_DEFAULT_LOCALE)?.label ??
    translations[0]?.label ??
    ''
  );
}

function itemDto(record: ItemRecord): LookupItemDto {
  return {
    id: record.id,
    code: record.code,
    translations: LOOKUP_LOCALES.map((locale) => {
      const entry = record.translations.find((translation) => translation.locale === locale);
      return { locale, label: entry?.label ?? '', description: entry?.description ?? null };
    }),
    parentCode: record.parent?.code ?? null,
    parentLabel: record.parent ? defaultLabel(record.parent.translations) : null,
    isActive: record.isActive,
    isCustomerVisible: record.isCustomerVisible,
    sourceRef: record.sourceRef,
    metadata: (record.metadata ?? null) as Record<string, unknown> | null,
    sortOrder: record.sortOrder,
    version: record.version,
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class LookupsService {
  private readonly logger = new Logger(LookupsService.name);

  constructor(
    private readonly repository: LookupsRepository,
    private readonly context: TenantContext,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Administration is internal-only; an impersonating session never writes. */
  private authorize(write = false) {
    const actor = this.context.require();
    if (!actor.isInternal || !actor.permissions.has(PERMISSIONS.ADMIN_LOOKUPS_MANAGE)) {
      throw new ForbiddenException('Internal staff permission required.');
    }
    if (write && actor.onBehalfOfUserId) {
      throw new ForbiddenException('Impersonated sessions are read-only.');
    }
    return actor;
  }

  private async categoryDto(tx: TenantClient, category: CategoryRecord): Promise<LookupCategoryDto> {
    const summary = await this.summary(tx, category.id);
    return {
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description,
      ownership: category.ownership,
      sourceSystem: category.sourceSystem,
      sourceRef: category.sourceRef,
      parentCategoryCode: category.parentCategory?.code ?? null,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      metadata: (category.metadata ?? null) as Record<string, unknown> | null,
      canEditContent: canEditContent(category.ownership),
      canRetire: canRetire(category.ownership),
      ...summary,
    };
  }

  private async summary(tx: TenantClient, categoryId: string) {
    const rows = await tx.$queryRaw<
      { items: bigint; visible: bigint; last_changed: Date | null }[]
    >`SELECT count(*)::bigint AS items,
             count(*) FILTER (WHERE is_customer_visible)::bigint AS visible,
             max(updated_at) AS last_changed
      FROM lookup_item WHERE category_id = ${categoryId}::uuid`;

    const labelled = await tx.$queryRaw<{ locale: string; labelled: bigint }[]>`
      SELECT t.locale, count(*)::bigint AS labelled
      FROM lookup_item_translation t
      JOIN lookup_item i ON i.id = t.item_id
      WHERE i.category_id = ${categoryId}::uuid
      GROUP BY t.locale`;

    const itemCount = Number(rows[0]?.items ?? 0);
    return {
      itemCount,
      customerVisibleCount: Number(rows[0]?.visible ?? 0),
      lastChangedAt: rows[0]?.last_changed?.toISOString() ?? null,
      completeLocales: LOOKUP_LOCALES.filter(
        (locale) =>
          itemCount > 0 &&
          Number(labelled.find((row) => row.locale === locale)?.labelled ?? 0) === itemCount,
      ) as string[],
    };
  }

  // --- reads -----------------------------------------------------------------

  async categories(): Promise<LookupCategoryDto[]> {
    this.authorize();
    return this.repository.runInternal(async (tx) => {
      const categories = await tx.lookupCategory.findMany({
        include: { parentCategory: { select: { code: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });

      // Two grouped passes rather than three queries per category.
      const totals = await tx.$queryRaw<
        { category_id: string; items: bigint; visible: bigint; last_changed: Date | null }[]
      >`SELECT category_id,
               count(*)::bigint AS items,
               count(*) FILTER (WHERE is_customer_visible)::bigint AS visible,
               max(updated_at) AS last_changed
        FROM lookup_item GROUP BY category_id`;

      const labelled = await tx.$queryRaw<
        { category_id: string; locale: string; labelled: bigint }[]
      >`SELECT i.category_id, t.locale, count(*)::bigint AS labelled
        FROM lookup_item_translation t
        JOIN lookup_item i ON i.id = t.item_id
        GROUP BY i.category_id, t.locale`;

      const totalBy = new Map(totals.map((row) => [row.category_id, row]));

      return categories.map((category) => {
        const row = totalBy.get(category.id);
        const itemCount = Number(row?.items ?? 0);
        return {
          id: category.id,
          code: category.code,
          name: category.name,
          description: category.description,
          ownership: category.ownership,
          sourceSystem: category.sourceSystem,
          sourceRef: category.sourceRef,
          parentCategoryCode: category.parentCategory?.code ?? null,
          isActive: category.isActive,
          sortOrder: category.sortOrder,
          metadata: (category.metadata ?? null) as Record<string, unknown> | null,
          canEditContent: canEditContent(category.ownership),
          canRetire: canRetire(category.ownership),
          itemCount,
          customerVisibleCount: Number(row?.visible ?? 0),
          completeLocales: LOOKUP_LOCALES.filter(
            (locale) =>
              itemCount > 0 &&
              Number(
                labelled.find((entry) => entry.category_id === category.id && entry.locale === locale)?.labelled ?? 0,
              ) === itemCount,
          ) as string[],
          lastChangedAt: row?.last_changed?.toISOString() ?? null,
        };
      });
    });
  }

  async items(categoryCode: string, query: LookupItemQuery): Promise<LookupItemListDto> {
    this.authorize();
    return this.repository.runInternal(async (tx) => {
      const category = await this.requireCategory(tx, categoryCode);

      const where: Prisma.LookupItemWhereInput = {
        categoryId: category.id,
        ...(query.status === 'all' ? {} : { isActive: query.status === 'active' }),
        ...(query.visibility === 'all' ? {} : { isCustomerVisible: query.visibility === 'customer' }),
        ...(query.parentCode ? { parent: { code: query.parentCode } } : {}),
        // Code, any label, any description and the parent's code, so an
        // administrator finds a row by whichever of those they know.
        ...(query.search
          ? {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { translations: { some: { label: { contains: query.search, mode: 'insensitive' } } } },
                { translations: { some: { description: { contains: query.search, mode: 'insensitive' } } } },
                { parent: { code: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };

      const [total, records] = await Promise.all([
        tx.lookupItem.count({ where }),
        tx.lookupItem.findMany({
          where,
          include: withTranslations,
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      return {
        category: await this.categoryDto(tx, category),
        items: records.map(itemDto),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  /** Candidate parents for a value, resolved in the category the rules permit. */
  async parentOptions(categoryCode: string): Promise<LookupItemDto[]> {
    this.authorize();
    return this.repository.runInternal(async (tx) => {
      const category = await this.requireCategory(tx, categoryCode);
      if (!category.parentCategoryId) return [];
      const records = await tx.lookupItem.findMany({
        where: { categoryId: category.parentCategoryId, isActive: true },
        include: withTranslations,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        take: 500,
      });
      return records.map(itemDto);
    });
  }

  // --- writes ----------------------------------------------------------------

  async createCategory(input: LookupCategoryCreate): Promise<LookupCategoryDto> {
    const actor = this.authorize(true);
    const result = await this.repository.runInternal(async (tx) => {
      const existing = await tx.lookupCategory.findUnique({ where: { code: input.code } });
      if (existing) throw new ConflictException({ message: 'That list code already exists.', details: { code: 'CODE_TAKEN' } });

      // A list may nest inside itself; any other parent must already exist.
      const selfNesting = input.parentCategoryCode === input.code;
      let parentCategoryId: string | null = null;
      if (input.parentCategoryCode && !selfNesting) {
        const parent = await tx.lookupCategory.findUnique({ where: { code: input.parentCategoryCode } });
        if (!parent) throw new BadRequestException('The parent list does not exist.');
        parentCategoryId = parent.id;
      }

      const created = await tx.lookupCategory.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description,
          // Anything created here is portal owned by definition: the portal
          // cannot invent a list that a source or the code base owns.
          ownership: 'portal',
          sourceRef: 'Created in the portal',
          parentCategoryId,
          sortOrder: input.sortOrder,
          metadata: jsonInput(input.metadata),
        },
      });

      const saved = selfNesting
        ? await tx.lookupCategory.update({
            where: { id: created.id },
            data: { parentCategoryId: created.id },
            include: { parentCategory: { select: { code: true } } },
          })
        : await this.requireCategory(tx, created.code);

      await this.audit(tx, actor, 'lookup.category.created', saved.id, {
        code: saved.code, name: saved.name, parentCategoryCode: saved.parentCategory?.code ?? null, reason: input.reason,
      });
      return this.categoryDto(tx, saved);
    });
    this.track('lookup.category.created', result.id);
    return result;
  }

  async updateCategory(code: string, input: LookupCategoryUpdate): Promise<LookupCategoryDto> {
    const actor = this.authorize(true);
    const result = await this.repository.runInternal(async (tx) => {
      const category = await this.requireCategory(tx, code);
      const editable = canEditContent(category.ownership);
      const retirable = canRetire(category.ownership);

      // A list owned elsewhere keeps its name and structure; retiring it is still ours.
      if (!editable) {
        const untouched =
          input.name === category.name &&
          (input.description ?? null) === (category.description ?? null) &&
          (input.parentCategoryCode ?? null) === (category.parentCategory?.code ?? null) &&
          (retirable || input.isActive === category.isActive);
        if (!untouched) {
          throw new ConflictException({
            message: retirable
              ? 'Only activation and ordering can be changed on a list maintained by its source system.'
              : 'This list mirrors an application setting and cannot be edited here.',
            details: { code: 'NOT_PORTAL_OWNED' },
          });
        }
      }

      let parentCategoryId: string | null = category.parentCategoryId;
      if (editable) {
        parentCategoryId = null;
        if (input.parentCategoryCode === category.code) {
          parentCategoryId = category.id;
        } else if (input.parentCategoryCode) {
          const parent = await tx.lookupCategory.findUnique({ where: { code: input.parentCategoryCode } });
          if (!parent) throw new BadRequestException('The parent list does not exist.');
          parentCategoryId = parent.id;
        }

        // Dropping the parent rule would orphan the relationships already built on it.
        if (category.parentCategoryId && parentCategoryId !== category.parentCategoryId) {
          const parented = await tx.lookupItem.count({ where: { categoryId: category.id, parentId: { not: null } } });
          if (parented > 0) {
            throw new ConflictException({
              message: `${parented} values already use the current parent rule. Clear those parents first.`,
              details: { code: 'PARENT_RULE_IN_USE' },
            });
          }
        }
      }

      const saved = await tx.lookupCategory.update({
        where: { id: category.id },
        data: {
          name: editable ? input.name : category.name,
          description: editable ? input.description : category.description,
          parentCategoryId,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
          metadata: editable ? jsonInput(input.metadata) : undefined,
        },
        include: { parentCategory: { select: { code: true } } },
      });

      await this.audit(tx, actor, 'lookup.category.updated', saved.id, {
        code: saved.code,
        before: { name: category.name, isActive: category.isActive, parentCategoryCode: category.parentCategory?.code ?? null },
        after: { name: saved.name, isActive: saved.isActive, parentCategoryCode: saved.parentCategory?.code ?? null },
        reason: input.reason,
      });
      return this.categoryDto(tx, saved);
    });
    this.track('lookup.category.updated', result.id);
    return result;
  }

  async createItem(categoryCode: string, input: LookupItemCreate): Promise<LookupItemDto> {
    const actor = this.authorize(true);
    const result = await this.repository.runInternal(async (tx) => {
      const category = await this.requireCategory(tx, categoryCode);
      if (!canEditContent(category.ownership)) {
        throw new ConflictException({
          message: 'Values in this list come from its source system and cannot be added here.',
          details: { code: 'NOT_PORTAL_OWNED' },
        });
      }

      const clash = await tx.lookupItem.findFirst({ where: { categoryId: category.id, code: input.code } });
      if (clash) throw new ConflictException({ message: 'That code already exists in this list.', details: { code: 'CODE_TAKEN' } });

      const parentId = await this.resolveParent(tx, category, input.parentCode, null);

      const created = await tx.lookupItem.create({
        data: {
          categoryId: category.id,
          code: input.code,
          parentId,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
          // A value cannot be visible to customers while it is inactive.
          isCustomerVisible: input.isActive && input.isCustomerVisible,
          metadata: jsonInput(input.metadata),
          translations: {
            create: input.translations.map((entry) => ({
              locale: entry.locale, label: entry.label, description: entry.description,
            })),
          },
        },
        include: withTranslations,
      });

      await this.audit(tx, actor, 'lookup.item.created', created.id, {
        category: category.code, code: created.code, parentCode: input.parentCode, reason: input.reason,
      });
      return itemDto(created);
    });
    this.track('lookup.item.created', result.id);
    return result;
  }

  async updateItem(id: string, input: LookupItemUpdate): Promise<LookupItemDto> {
    const actor = this.authorize(true);
    const result = await this.repository.runInternal(async (tx) => {
      // Serialised against a concurrent edit of the same row before anything is read.
      await tx.$queryRaw`SELECT id FROM lookup_item WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await tx.lookupItem.findUnique({ where: { id }, include: withTranslations });
      if (!current) throw new NotFoundException('Unknown lookup value.');
      if (current.version !== input.version) {
        throw new ConflictException({ message: 'Reload the value before saving.', details: { code: 'STALE_LOOKUP' } });
      }

      const category = await this.requireCategory(tx, undefined, current.categoryId);
      const editable = canEditContent(category.ownership);
      const retirable = canRetire(category.ownership);

      // Source and system lists keep their own content. Two decisions stay ours: reach,
      // because approving a CargoWise document type for customers is a portal act, and
      // retirement, because whether Noatum uses a code at all is not the source's call.
      if (!editable) {
        const translationsUnchanged = input.translations.every((entry) => {
          const existing = current.translations.find((translation) => translation.locale === entry.locale);
          return existing?.label === entry.label && (existing?.description ?? null) === entry.description;
        });
        const untouched =
          input.parentCode === (current.parent?.code ?? null) &&
          (retirable || input.isActive === current.isActive) &&
          translationsUnchanged;
        if (!untouched) {
          throw new ConflictException({
            message: retirable
              ? 'Only activation, customer visibility and ordering can be changed on a value owned elsewhere.'
              : 'This list mirrors an application setting, so its values cannot be retired or renamed here.',
            details: { code: 'SOURCE_OWNED_FIELD' },
          });
        }
      }

      const parentId = editable
        ? await this.resolveParent(tx, category, input.parentCode, current.id)
        : current.parentId;

      // Retiring a value that still has active children would leave them unreachable.
      if (current.isActive && !input.isActive) {
        const activeChildren = await tx.lookupItem.count({ where: { parentId: current.id, isActive: true } });
        if (activeChildren > 0) {
          throw new ConflictException({
            message: `Deactivate the ${activeChildren} values beneath this one first.`,
            details: { code: 'HAS_ACTIVE_CHILDREN' },
          });
        }
      }

      const isActive = input.isActive;
      const isCustomerVisible = isActive && input.isCustomerVisible;

      if (editable) {
        for (const entry of input.translations) {
          await tx.lookupItemTranslation.upsert({
            where: { itemId_locale: { itemId: id, locale: entry.locale } },
            create: { itemId: id, locale: entry.locale, label: entry.label, description: entry.description },
            update: { label: entry.label, description: entry.description },
          });
        }
      }

      const saved = await tx.lookupItem.update({
        where: { id },
        data: {
          parentId,
          sortOrder: input.sortOrder,
          isActive,
          isCustomerVisible,
          metadata: jsonInput(input.metadata),
          version: { increment: 1 },
        },
        include: withTranslations,
      });

      await this.audit(tx, actor, 'lookup.item.updated', id, {
        category: category.code,
        code: saved.code,
        before: {
          isActive: current.isActive, isCustomerVisible: current.isCustomerVisible,
          parentCode: current.parent?.code ?? null, sortOrder: current.sortOrder,
          labels: current.translations.map(({ locale, label }) => ({ locale, label })),
        },
        after: {
          isActive: saved.isActive, isCustomerVisible: saved.isCustomerVisible,
          parentCode: saved.parent?.code ?? null, sortOrder: saved.sortOrder,
          labels: saved.translations.map(({ locale, label }) => ({ locale, label })),
        },
        reason: input.reason,
      });
      return itemDto(saved);
    });
    this.track('lookup.item.updated', result.id);
    return result;
  }

  // --- helpers ---------------------------------------------------------------

  private async requireCategory(tx: TenantClient, code?: string, id?: string) {
    const category = await tx.lookupCategory.findFirst({
      where: code ? { code } : { id },
      include: { parentCategory: { select: { code: true } } },
    });
    if (!category) throw new NotFoundException('Unknown lookup category.');
    return category;
  }

  /**
   * Resolves a parent code inside the category the rules permit, refusing a
   * self-parent and any cycle the walk up the tree finds.
   */
  private async resolveParent(
    tx: TenantClient,
    category: CategoryRecord,
    parentCode: string | null,
    itemId: string | null,
  ): Promise<string | null> {
    if (!parentCode) return null;
    if (!category.parentCategoryId) {
      throw new BadRequestException('This list is flat, so its values cannot have a parent.');
    }

    const parent = await tx.lookupItem.findFirst({
      where: { categoryId: category.parentCategoryId, code: parentCode },
    });
    if (!parent) throw new BadRequestException('The parent value does not exist in the permitted list.');
    if (itemId && parent.id === itemId) throw new BadRequestException('A value cannot be its own parent.');

    if (itemId && category.parentCategoryId === category.id) {
      let ancestor = parent.parentId;
      // Bounded by depth, so a pre-existing loop cannot spin here.
      for (let depth = 0; ancestor && depth < 100; depth += 1) {
        if (ancestor === itemId) throw new BadRequestException('That parent would create a loop.');
        const next: { parentId: string | null } | null = await tx.lookupItem.findUnique({
          where: { id: ancestor }, select: { parentId: true },
        });
        ancestor = next?.parentId ?? null;
      }
    }
    return parent.id;
  }

  private async audit(
    tx: TenantClient,
    actor: { userId?: string; correlationId?: string },
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await tx.auditEvent.create({
      data: {
        actorUserId: actor.userId,
        action,
        entityType: action.startsWith('lookup.category') ? 'lookup_category' : 'lookup_item',
        entityId,
        metadata: { ...metadata, correlationId: actor.correlationId } as Prisma.InputJsonValue,
      },
    });
  }

  private track(action: string, entityId?: string) {
    const actor = this.context.require();
    this.logger.log({ event: 'AnalyticsEvent', action, actorUserId: actor.userId, entityId, correlationId: actor.correlationId });
    void this.analytics.record({ action, entityType: 'lookup', entityId });
  }
}
