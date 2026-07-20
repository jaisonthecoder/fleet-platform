import { describe, expect, it } from 'vitest'
import {
  descendantsOf,
  flattenHierarchy,
  type HierarchyNode,
} from './platform.contract'

const tree: HierarchyNode[] = [
  {
    id: 'g',
    parentId: null,
    levelIndex: 0,
    levelLabel: 'Group',
    name: 'Group',
    path: 'g',
    children: [
      {
        id: 'c',
        parentId: 'g',
        levelIndex: 1,
        levelLabel: 'Cluster',
        name: 'Cluster',
        path: 'g.c',
        children: [
          {
            id: 'p',
            parentId: 'c',
            levelIndex: 2,
            levelLabel: 'Pool',
            name: 'Pool',
            path: 'g.c.p',
            children: [],
          },
        ],
      },
    ],
  },
]

describe('flattenHierarchy', () => {
  it('pre-orders nodes and tags depth', () => {
    const flat = flattenHierarchy(tree)
    expect(flat.map((n) => n.id)).toEqual(['g', 'c', 'p'])
    expect(flat.map((n) => n.depth)).toEqual([0, 1, 2])
  })
})

describe('descendantsOf', () => {
  it('returns the node plus all descendants', () => {
    expect(descendantsOf(tree, 'c')).toEqual(['c', 'p'])
    expect(descendantsOf(tree, 'p')).toEqual(['p'])
    expect(descendantsOf(tree, 'missing')).toEqual([])
  })
})
