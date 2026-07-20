import {
  buildTree,
  descendantsOf,
  effectiveAt,
  type FlatNode,
  rollUp,
} from './hierarchy-tree';

// Cluster → Pool → Location (3-level) sample.
const nodes: FlatNode[] = [
  { id: 'c1', parentId: null, levelIndex: 0, levelLabel: 'Cluster', name: 'Ports', path: 'c1' },
  { id: 'p1', parentId: 'c1', levelIndex: 1, levelLabel: 'Pool', name: 'Mina Zayed', path: 'c1.p1' },
  { id: 'p2', parentId: 'c1', levelIndex: 1, levelLabel: 'Pool', name: 'Khalifa', path: 'c1.p2' },
  { id: 'l1', parentId: 'p1', levelIndex: 2, levelLabel: 'Location', name: 'Gate A', path: 'c1.p1.l1' },
];

describe('hierarchy-tree', () => {
  it('builds an N-level nested tree', () => {
    const roots = buildTree(nodes);
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe('c1');
    expect(roots[0].children.map((c) => c.id).sort()).toEqual(['p1', 'p2']);
    const p1 = roots[0].children.find((c) => c.id === 'p1')!;
    expect(p1.children[0].id).toBe('l1');
  });

  it('drill-down returns the node and all descendants (any depth)', () => {
    expect(descendantsOf(nodes, 'c1').map((n) => n.id).sort()).toEqual(['c1', 'l1', 'p1', 'p2']);
    expect(descendantsOf(nodes, 'p1').map((n) => n.id).sort()).toEqual(['l1', 'p1']);
    expect(descendantsOf(nodes, 'p2').map((n) => n.id)).toEqual(['p2']);
    expect(descendantsOf(nodes, 'unknown')).toEqual([]);
  });

  it('rolls up a numeric measure over a subtree', () => {
    const vehicles = new Map([
      ['c1', 0],
      ['p1', 5],
      ['p2', 3],
      ['l1', 2],
    ]);
    expect(rollUp(nodes, 'c1', vehicles)).toBe(10);
    expect(rollUp(nodes, 'p1', vehicles)).toBe(7);
  });

  it('resolves the tree effective at a point in time (restructure-with-history)', () => {
    const rows = [
      { id: 'old', validFrom: new Date('2026-01-01'), validTo: new Date('2026-06-01') },
      { id: 'new', validFrom: new Date('2026-06-01'), validTo: null },
    ];
    expect(effectiveAt(rows, new Date('2026-03-01')).map((r) => r.id)).toEqual(['old']);
    expect(effectiveAt(rows, new Date('2026-07-01')).map((r) => r.id)).toEqual(['new']);
  });
});
