import type { LookupValueDto } from '../../../contracts/lookup.contract';

/**
 * Nests a flat, sort-ordered lookup value list into a tree by `parentId`
 * (cascading dropdowns / hierarchical types). Pure — no I/O — so the nesting is
 * unit-testable. Values whose parent is absent from the set surface as roots.
 */
export function buildLookupTree(flat: LookupValueDto[]): LookupValueDto[] {
  const byId = new Map<string, LookupValueDto>();
  for (const v of flat) {
    byId.set(v.id, { ...v, children: [] });
  }
  const roots: LookupValueDto[] = [];
  for (const v of byId.values()) {
    if (v.parentId && byId.has(v.parentId)) {
      byId.get(v.parentId)!.children!.push(v);
    } else {
      roots.push(v);
    }
  }
  return roots;
}
