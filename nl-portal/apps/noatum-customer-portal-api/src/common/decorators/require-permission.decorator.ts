import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@/contracts';

export const PERMISSIONS_KEY = 'noatum:permissions';

/**
 * Declare the permissions an endpoint needs. Keys come from PERMISSIONS in
 * @/contracts - the type stops string literals getting in.
 *
 * Multiple keys are ANDed. For an either/or, model it as one permission instead.
 */
export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
