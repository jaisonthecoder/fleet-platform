/**
 * Role presentation, shared by the staff listing and the shell badge so a person
 * is never labelled one way in the table and another in the header.
 *
 * Order is presentation precedence only: when somebody holds several roles the
 * header shows the first match. It confers nothing - authorization is always the
 * union of the permissions behind every role held.
 */
export const roleLabels: Record<string, string> = {
  platform_admin: 'platformAdmin',
  customer_success: 'customerSuccess',
  pricing: 'pricing',
  pricing_approver: 'pricingApprover',
  ops: 'ops',
  // Customer presets are never assignable from the staff screen; they appear
  // only when a record already carries one, so it can still be named.
  customer_standard: 'customerStandard',
  customer_quoting_booking: 'customerQuotingBooking',
  customer_finance: 'customerFinance',
  customer_analyst: 'customerAnalyst',
  customer_claims: 'customerClaims',
  customer_admin: 'customerAdmin',
};

export const rolePrecedence = [
  'platform_admin',
  'customer_success',
  'pricing_approver',
  'pricing',
  'ops',
] as const;

export function primaryRole(roleKeys: readonly string[]): string | undefined {
  return rolePrecedence.find((key) => roleKeys.includes(key));
}

/** Initials for a round avatar, from the display name or the email local part. */
export function initials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0]?.replace(/[._-]+/g, ' ') || '';
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}
