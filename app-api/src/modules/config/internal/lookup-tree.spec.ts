import type { LookupValueDto } from '../../../contracts/lookup.contract';
import { buildLookupTree } from './lookup-tree';

const v = (id: string, code: string, parentId: string | null): LookupValueDto => ({
  id,
  code,
  labelEn: code,
  labelAr: code,
  descriptionEn: null,
  descriptionAr: null,
  parentId,
  sortOrder: 0,
});

describe('buildLookupTree', () => {
  it('nests values by parent (cascading, e.g. Make → Model)', () => {
    const flat = [v('m1', 'TOYOTA', null), v('m2', 'LANDCRUISER', 'm1'), v('m3', 'HILUX', 'm1'), v('n1', 'NISSAN', null)];
    const tree = buildLookupTree(flat);
    expect(tree.map((t) => t.code).sort()).toEqual(['NISSAN', 'TOYOTA']);
    const toyota = tree.find((t) => t.code === 'TOYOTA')!;
    expect(toyota.children!.map((c) => c.code).sort()).toEqual(['HILUX', 'LANDCRUISER']);
  });

  it('treats values with an absent parent as roots', () => {
    const tree = buildLookupTree([v('x', 'ORPHAN', 'missing')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].code).toBe('ORPHAN');
  });
});
