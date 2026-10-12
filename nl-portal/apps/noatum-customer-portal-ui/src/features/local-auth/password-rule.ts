/**
 * The password rule, mirrored from the API contract so the form can answer at once.
 *
 * The server is the rulebook; this exists only so a weak password is caught before it
 * is sent. Without it the API answers 400, which this feature maps to "that link has
 * expired" - the same status, an entirely wrong message.
 *
 * Keep in step with PASSWORD_MIN_LENGTH and the refine in the API's local-auth contract.
 */
export const PASSWORD_MIN_LENGTH = 8;

export function meetsPasswordRule(value: string): boolean {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}
