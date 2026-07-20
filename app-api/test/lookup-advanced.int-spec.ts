import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LookupService } from '../src/modules/config/services/lookup.service';

/**
 * Integration proof of the ADVANCED lookup manager (type→type parent /
 * cascading, cross-type value parents, re-parenting with cycle guards,
 * lifecycle activate, and bulk import/export). Requires a live DB + Redis.
 */
describe('lookup advanced (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let lookups: LookupService;

  const s = randomUUID().slice(0, 8);
  const makeType = `it-make-${s}`;
  const modelType = `it-model-${s}`;
  const selfType = `it-self-${s}`;
  const importType = `it-imp-${s}`;
  const cycleA = `it-cyca-${s}`;
  const cycleB = `it-cycb-${s}`;

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    lookups = ctx.get(LookupService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates a cascading type with a parent type and links a cross-type value parent', async () => {
    await lookups.createType({ code: makeType, labelEn: 'IT Make', labelAr: 'صانع' });
    const model = await lookups.createType({
      code: modelType,
      labelEn: 'IT Model',
      labelAr: 'طراز',
      parentTypeCode: makeType,
    });
    expect(model.parentTypeCode).toBe(makeType);
    expect(model.parentTypeLabelEn).toBe('IT Make');
    expect(model.isHierarchical).toBe(false);

    await lookups.createValue(makeType, { code: 'TOYOTA', labelEn: 'Toyota', labelAr: 'تويوتا' });
    await lookups.createValue(modelType, {
      code: 'COROLLA',
      labelEn: 'Corolla',
      labelAr: 'كورولا',
      parentCode: 'TOYOTA',
    });

    const grid = await lookups.listValuesForAdmin(modelType, { page: 1, pageSize: 25 });
    const corolla = grid.items.find((v) => v.code === 'COROLLA');
    expect(corolla?.parentCode).toBe('TOYOTA');
    expect(corolla?.parentLabelEn).toBe('Toyota');

    const options = await lookups.parentOptions(modelType);
    expect(options.map((o) => o.code)).toContain('TOYOTA');
    expect(options[0]?.typeCode).toBe(makeType);
  });

  it('rejects a value parent that is not in the parent type', async () => {
    await expect(
      lookups.createValue(modelType, {
        code: 'GHOST',
        labelEn: 'Ghost',
        labelAr: 'شبح',
        parentCode: 'NOT-A-MAKE',
      }),
    ).rejects.toThrow();
  });

  it('forbids a type being both self-hierarchical and having a parent type', async () => {
    await expect(
      lookups.createType({
        code: `it-bad-${s}`,
        labelEn: 'Bad',
        labelAr: 'سيئ',
        isHierarchical: true,
        parentTypeCode: makeType,
      }),
    ).rejects.toThrow();
  });

  it('prevents a type-to-type parent cycle', async () => {
    await lookups.createType({ code: cycleA, labelEn: 'A', labelAr: 'أ' });
    const b = await lookups.createType({ code: cycleB, labelEn: 'B', labelAr: 'ب', parentTypeCode: cycleA });
    // Now point A at B → A→B→A cycle.
    const a = await lookups.listTypes().then((t) => t.find((x) => x.code === cycleA));
    await expect(
      lookups.updateType(a!.id, { parentTypeCode: cycleB }),
    ).rejects.toThrow();
    expect(b.parentTypeCode).toBe(cycleA);
  });

  it('re-parents within a self-hierarchical type, guards descendant cycles, and promotes to top level', async () => {
    await lookups.createType({ code: selfType, labelEn: 'IT Self', labelAr: 'ذاتي', isHierarchical: true });
    const p = await lookups.createValue(selfType, { code: 'P', labelEn: 'P', labelAr: 'ب' });
    const c = await lookups.createValue(selfType, { code: 'C', labelEn: 'C', labelAr: 'ج', parentCode: 'P' });
    await lookups.createValue(selfType, { code: 'GC', labelEn: 'GC', labelAr: 'ح', parentCode: 'C' });

    // Cannot move P under its own descendant GC.
    await expect(lookups.updateValue(p.id, { parentCode: 'GC' })).rejects.toThrow();

    // Re-parent C's grandchild directly under P (valid move).
    const gc = (await lookups.listChildrenForAdmin(selfType, 'C'))[0];
    await lookups.updateValue(gc.id, { parentCode: 'P' });
    expect((await lookups.listChildrenForAdmin(selfType, 'P')).map((v) => v.code).sort()).toEqual(
      ['C', 'GC'],
    );

    // Promote C to top level (clear parent).
    await lookups.updateValue(c.id, { parentCode: null });
    const top = await lookups.listValuesForAdmin(selfType, { parentCode: '', page: 1, pageSize: 25 });
    // parentCode '' is ignored by the query (min length), so assert via the value row.
    const refetched = top.items.find((v) => v.code === 'C');
    expect(refetched?.parentCode).toBeNull();
  });

  it('deactivates then reactivates a value', async () => {
    const v = await lookups.createValue(makeType, { code: 'NISSAN', labelEn: 'Nissan', labelAr: 'نيسان' });
    await lookups.deactivateValue(v.id);
    let grid = await lookups.listValuesForAdmin(makeType, { status: 'Inactive', page: 1, pageSize: 25 });
    expect(grid.items.find((x) => x.code === 'NISSAN')?.status).toBe('Inactive');
    await lookups.activateValue(v.id);
    grid = await lookups.listValuesForAdmin(makeType, { status: 'Active', page: 1, pageSize: 25 });
    expect(grid.items.find((x) => x.code === 'NISSAN')?.status).toBe('Active');
  });

  it('bulk imports (upsert) and exports values, wiring self-hierarchy parents', async () => {
    await lookups.createType({ code: importType, labelEn: 'IT Import', labelAr: 'استيراد', isHierarchical: true });
    const summary = await lookups.importValues(importType, {
      rows: [
        { code: 'ROOT', labelEn: 'Root', labelAr: 'جذر', sortOrder: 1 },
        { code: 'LEAF', labelEn: 'Leaf', labelAr: 'ورقة', parentCode: 'ROOT', sortOrder: 2 },
      ],
    });
    expect(summary.created).toBe(2);
    expect(summary.updated).toBe(0);
    expect(summary.errors).toHaveLength(0);

    // Re-import updates ROOT and reports the bad parent.
    const summary2 = await lookups.importValues(importType, {
      rows: [
        { code: 'ROOT', labelEn: 'Root (renamed)', labelAr: 'جذر', sortOrder: 5 },
        { code: 'ORPHAN', labelEn: 'Orphan', labelAr: 'يتيم', parentCode: 'MISSING' },
      ],
    });
    expect(summary2.updated).toBe(1);
    expect(summary2.created).toBe(1);
    expect(summary2.errors.some((e) => e.code === 'ORPHAN')).toBe(true);

    const rows = await lookups.exportType(importType);
    const leaf = rows.find((r) => r.code === 'LEAF');
    expect(leaf?.parentCode).toBe('ROOT');
    expect(rows.find((r) => r.code === 'ROOT')?.labelEn).toBe('Root (renamed)');
  });

  it('exposes child TYPES on the admin catalogue (parent_type_id points back)', async () => {
    const types = await lookups.listTypesForAdmin();
    const make = types.find((t) => t.code === makeType);
    expect(make?.childTypes.map((c) => c.code)).toContain(modelType);
    // A leaf/flat type (the model) has no child types of its own here.
    const model = types.find((t) => t.code === modelType);
    expect(model?.childTypes).toHaveLength(0);
  });

  it('returns cross-type children of a value tagged with their own type', async () => {
    // Toyota (a Make value) has Corolla, a MODEL value, as a cross-type child.
    const makeGrid = await lookups.listValuesForAdmin(makeType, { page: 1, pageSize: 25 });
    const toyota = makeGrid.items.find((v) => v.code === 'TOYOTA');
    expect(toyota).toBeDefined();

    const children = await lookups.listChildrenByValueId(toyota!.id);
    const corolla = children.find((c) => c.code === 'COROLLA');
    expect(corolla).toBeDefined();
    expect(corolla?.typeCode).toBe(modelType);
    expect(corolla?.typeLabelEn).toBe('IT Model');
    expect(corolla?.parentId).toBe(toyota!.id);
  });
});
