import { z } from 'zod';

export const organizationSettingsSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  defaultCurrency: z.string().min(3),
  defaultTimezone: z.string().min(1),
  revision: z.number().int().positive(),
  createdAtUtc: z.string().datetime(),
  updatedAtUtc: z.string().datetime(),
});
export type OrganizationSettingsDto = z.infer<typeof organizationSettingsSchema>;

export interface OrganizationHierarchyNodeDto {
  id: string;
  organizationId: string;
  parentId: string | null;
  parentCode: string | null;
  parentName: string | null;
  code: string;
  levelIndex: number;
  levelCode: string;
  levelLabel: string;
  name: string;
  nameAr: string;
  path: string;
  validFrom: string;
  validTo: string | null;
  revision: number;
  childCount: number;
  vehicleCount: number;
  userCount: number;
  utilizedVehicleCount: number;
  utilizationPercent: number;
  children: OrganizationHierarchyNodeDto[];
}

export const organizationQualitySchema = z.object({
  activeNodes: z.number().int().nonnegative(),
  activeRoots: z.number().int().nonnegative(),
  missingCodes: z.number().int().nonnegative(),
  missingArabicNames: z.number().int().nonnegative(),
  missingLevelCodes: z.number().int().nonnegative(),
  peopleWithoutHomeScope: z.number().int().nonnegative(),
  activeRoleAssignments: z.number().int().nonnegative(),
  activeVehicleAssignments: z.number().int().nonnegative(),
  healthy: z.boolean(),
  reasons: z.array(z.string()),
});
export type OrganizationQualityDto = z.infer<typeof organizationQualitySchema>;

export interface OrganizationWorkspaceDto {
  organization: OrganizationSettingsDto;
  levels: OrganizationHierarchyLevelDto[];
  hierarchy: OrganizationHierarchyNodeDto[];
  quality: OrganizationQualityDto;
}

export interface OrganizationHierarchyLevelDto {
  id: string;
  code: string;
  position: number;
  labelEn: string;
  labelAr: string;
  mandatory: boolean;
  active: boolean;
  revision: number;
  nodeCount: number;
}

export interface OrganizationNodeDetailDto {
  node: OrganizationHierarchyNodeDto;
  scopedRoles: Array<{
    assignmentId: string;
    personId: string;
    fullName: string;
    role: string;
  }>;
  recentTransfers: Array<{
    id: string;
    vehicleId: string;
    plate: string;
    fromCode: string | null;
    fromName: string | null;
    toCode: string;
    toName: string;
    effectiveDate: string;
    reason: string | null;
  }>;
  recentChanges: Array<{
    id: string;
    action: string;
    actorRef: string;
    reason: string | null;
    atUtc: string;
  }>;
}

export const createHierarchyLevelSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
  labelEn: z.string().trim().min(1).max(80),
  labelAr: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(3).max(500),
});
export type CreateHierarchyLevel = z.infer<typeof createHierarchyLevelSchema>;

export const updateHierarchyLevelSchema = z.object({
  expectedRevision: z.number().int().positive(),
  labelEn: z.string().trim().min(1).max(80),
  labelAr: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(3).max(500),
});
export type UpdateHierarchyLevel = z.infer<typeof updateHierarchyLevelSchema>;

export const reorderHierarchyLevelsSchema = z.object({
  orderedCodes: z.array(z.string().min(1)).min(1).max(5),
  expectedOrganizationRevision: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});
export type ReorderHierarchyLevels = z.infer<typeof reorderHierarchyLevelsSchema>;

const stableNodeCode = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/);

export const createHierarchyNodeSchema = z.object({
  parentId: z.string().uuid(),
  code: stableNodeCode,
  name: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().min(1).max(160),
  levelCode: z.string().trim().min(1).max(40),
  levelLabel: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(3).max(500),
});
export type CreateHierarchyNode = z.infer<typeof createHierarchyNodeSchema>;

export const renameHierarchyNodeSchema = z.object({
  expectedRevision: z.number().int().positive(),
  name: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(3).max(500),
});
export type RenameHierarchyNode = z.infer<typeof renameHierarchyNodeSchema>;

export const retireHierarchyNodeSchema = z.object({
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});
export type RetireHierarchyNode = z.infer<typeof retireHierarchyNodeSchema>;

export const moveHierarchyNodeSchema = z.object({
  targetParentId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  impactToken: z.string().min(32),
  reason: z.string().trim().min(3).max(500),
});
export type MoveHierarchyNode = z.infer<typeof moveHierarchyNodeSchema>;

export const reactivateHierarchyNodeSchema = z.object({
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});
export type ReactivateHierarchyNode = z.infer<typeof reactivateHierarchyNodeSchema>;

export const hierarchyImpactSchema = z.object({
  nodeId: z.string().uuid(),
  childNodes: z.number().int().nonnegative(),
  people: z.number().int().nonnegative(),
  roles: z.number().int().nonnegative(),
  vehicles: z.number().int().nonnegative(),
  entitlements: z.number().int().nonnegative(),
  policyRules: z.number().int().nonnegative(),
  blocking: z.boolean(),
  reasons: z.array(z.string()),
  impactToken: z.string(),
});
export type HierarchyImpactDto = z.infer<typeof hierarchyImpactSchema>;
