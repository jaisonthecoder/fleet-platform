import type { Locale, UserStatus } from '../enums';
import type { PermissionKey, RoleKey } from '../permissions';

/** What /me returns. The SPA shell is built entirely from this. */
export interface MeDto {
  userId: string;
  customerGroupId: string | null;
  isInternal: boolean;
  /** Set while a Noatum user is impersonating; the SPA shows a persistent banner. */
  onBehalfOfUserId: string | null;
  accountIds: string[];
  permissions: PermissionKey[];
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  status: UserStatus;
  roles: RoleKey[];
  /** Empty means every account in the group. */
  accountIds: string[];
  lastLoginAt: string | null;
}

export interface InviteUserDto {
  email: string;
  displayName: string;
  roles: RoleKey[];
  accountIds?: string[];
  locale?: Locale;
}

export interface PagedDto<T> {
  items: T[];
  nextCursor: string | null;
}
