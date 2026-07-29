import { and, eq, isNull, sql } from 'drizzle-orm';
import type { DrizzleDatabase } from '../../src/common/database/database.module';
import {
  DEFAULT_ORGANIZATION_ID,
  hierarchyNode,
} from '../../src/common/database/schema';

export interface CoreHierarchyFixture {
  rootId: string;
  clusterId: string;
  poolId: string;
  locationIds: string[];
  cleanupHierarchy(): Promise<void>;
}

interface CoreHierarchyOptions {
  suiteCode: string;
  locationCount?: number;
}

export async function createCoreHierarchyFixture(
  db: DrizzleDatabase,
  options: CoreHierarchyOptions,
): Promise<CoreHierarchyFixture> {
  const suiteCode = options.suiteCode
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const locationCount = options.locationCount ?? 1;
  if (!suiteCode) {
    throw new TypeError('suiteCode must contain at least one letter or number');
  }
  if (!Number.isInteger(locationCount) || locationCount <= 0) {
    throw new TypeError('locationCount must be a positive integer');
  }
  const organizationId = DEFAULT_ORGANIZATION_ID;

  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`core-hierarchy-root:${organizationId}`}, 0)
      )
    `);

    let [root] = await tx
      .select({ id: hierarchyNode.id, path: hierarchyNode.path })
      .from(hierarchyNode)
      .where(and(
        eq(hierarchyNode.organizationId, organizationId),
        isNull(hierarchyNode.parentId),
        isNull(hierarchyNode.validTo),
      ));

    if (!root) {
      await tx
        .insert(hierarchyNode)
        .values({
          organizationId,
          code: 'CORE-ROOT',
          levelIndex: 0,
          levelLabel: 'Group',
          levelCode: 'GROUP',
          name: 'Core Root',
          nameAr: 'Core Root',
          path: sql`'core_root'::ltree`,
        });
    }

    [root] = await tx
      .select({ id: hierarchyNode.id, path: hierarchyNode.path })
      .from(hierarchyNode)
      .where(and(
        eq(hierarchyNode.organizationId, organizationId),
        isNull(hierarchyNode.parentId),
        isNull(hierarchyNode.validTo),
      ));
    if (!root) {
      throw new Error(`Failed to provision hierarchy root for organization ${organizationId}`);
    }

    const [cluster] = await tx
      .insert(hierarchyNode)
      .values({
        organizationId,
        parentId: root.id,
        code: `CORE-CLUSTER-${suiteCode.toUpperCase()}`,
        levelIndex: 1,
        levelLabel: 'Cluster',
        levelCode: 'CLUSTER',
        name: `Core Cluster ${suiteCode}`,
        nameAr: `Core Cluster ${suiteCode}`,
        path: sql`${`${root.path}.cluster_${suiteCode}`}::ltree`,
      })
      .returning({ id: hierarchyNode.id, path: hierarchyNode.path });

    const [pool] = await tx
      .insert(hierarchyNode)
      .values({
        organizationId,
        parentId: cluster.id,
        code: `CORE-POOL-${suiteCode.toUpperCase()}`,
        levelIndex: 2,
        levelLabel: 'Pool',
        levelCode: 'POOL',
        name: `Core Pool ${suiteCode}`,
        nameAr: `Core Pool ${suiteCode}`,
        path: sql`${`${cluster.path}.pool_${suiteCode}`}::ltree`,
      })
      .returning({ id: hierarchyNode.id, path: hierarchyNode.path });

    const locations = await tx
      .insert(hierarchyNode)
      .values(Array.from({ length: locationCount }, (_, index) => ({
        organizationId,
        parentId: pool.id,
        code: `CORE-LOCATION-${suiteCode.toUpperCase()}-${index + 1}`,
        levelIndex: 3,
        levelLabel: 'Location',
        levelCode: 'LOCATION',
        name: `Core Location ${suiteCode} ${index + 1}`,
        nameAr: `Core Location ${suiteCode} ${index + 1}`,
        path: sql`${`${pool.path}.location_${suiteCode}_${index + 1}`}::ltree`,
      })))
      .returning({ id: hierarchyNode.id });

    return { root, cluster, pool, locations };
  });
  const ownedNodeIds = [
    ...created.locations.map(({ id }) => id),
    created.pool.id,
    created.cluster.id,
  ];

  return {
    rootId: created.root.id,
    clusterId: created.cluster.id,
    poolId: created.pool.id,
    locationIds: created.locations.map(({ id }) => id),
    async cleanupHierarchy(): Promise<void> {
      for (const id of ownedNodeIds) {
        await db.delete(hierarchyNode).where(eq(hierarchyNode.id, id));
      }
    },
  };
}