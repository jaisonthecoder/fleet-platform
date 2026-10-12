/**
 * What an Incoterm implies for the service scope.
 *
 * Shared because it is freight, not an assistant's opinion: the customer side
 * uses it to decide which addresses a request still needs, and the pricing side
 * uses it to decide which legs a quote has to carry charges for. One table, so
 * the two can never disagree about where our responsibility starts.
 *
 * The rule the requirement calls out: FOB Keelung means we collect at the PORT
 * of Keelung, never the seller's factory street address.
 */
export type ScopeEnd = 'door' | 'port';

export const INCOTERM_SCOPE: Record<string, { origin: ScopeEnd; destination: ScopeEnd }> = {
  EXW: { origin: 'door', destination: 'port' },
  FCA: { origin: 'port', destination: 'port' },
  FAS: { origin: 'port', destination: 'port' },
  FOB: { origin: 'port', destination: 'port' },
  CFR: { origin: 'port', destination: 'port' },
  CIF: { origin: 'port', destination: 'port' },
  CPT: { origin: 'port', destination: 'port' },
  CIP: { origin: 'port', destination: 'port' },
  DAP: { origin: 'port', destination: 'door' },
  DPU: { origin: 'port', destination: 'door' },
  DDP: { origin: 'port', destination: 'door' },
};

export function scopeOf(
  incoterm: string | null | undefined,
): { origin: ScopeEnd; destination: ScopeEnd } | null {
  const term = incoterm?.trim().toUpperCase();
  return term && term in INCOTERM_SCOPE ? INCOTERM_SCOPE[term]! : null;
}
