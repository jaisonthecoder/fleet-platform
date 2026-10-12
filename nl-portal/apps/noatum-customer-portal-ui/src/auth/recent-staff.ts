export interface RecentStaffProfile {
  displayName: string;
  email: string;
  branchName?: string;
}

const STORAGE_KEY = 'noatum.recent-staff';

export function recentStaffProfile(): RecentStaffProfile | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<RecentStaffProfile>;
    if (typeof parsed.displayName !== 'string' || typeof parsed.email !== 'string') return null;
    return {
      displayName: parsed.displayName,
      email: parsed.email,
      ...(typeof parsed.branchName === 'string' ? { branchName: parsed.branchName } : {}),
    };
  } catch {
    return null;
  }
}

export function rememberStaffProfile(profile: RecentStaffProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
