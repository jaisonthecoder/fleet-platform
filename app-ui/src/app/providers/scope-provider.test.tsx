import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ScopeProvider, useScope } from './scope-provider'

function Probe({ organizationId, authorizedScopeIds, preferredScopeId, allowAll = false }: { organizationId: string; authorizedScopeIds: string[]; preferredScopeId?: string; allowAll?: boolean }) {
  const scope = useScope()
  useEffect(() => scope.synchronizeScope({ organizationId, authorizedScopeIds, preferredScopeId, allowAll }), [allowAll, authorizedScopeIds, organizationId, preferredScopeId, scope])
  return <output aria-label="scope">{scope.selectedScopeId ?? 'all'}</output>
}

describe('ScopeProvider authorization synchronization', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      },
    })
  })

  it('restores a persisted scope only for the same organization and authorized closure', async () => {
    window.localStorage.setItem('wf-scope', JSON.stringify({ organizationId: 'org-1', scopeId: 'pool-2' }))
    render(<ScopeProvider><Probe organizationId="org-1" authorizedScopeIds={['pool-1', 'pool-2']} /></ScopeProvider>)
    expect(await screen.findByLabelText('scope')).toHaveTextContent('pool-2')
  })

  it('replaces revoked and cross-organization persisted scopes before exposing them', async () => {
    window.localStorage.setItem('wf-scope', JSON.stringify({ organizationId: 'org-2', scopeId: 'foreign-pool' }))
    const { rerender } = render(<ScopeProvider><Probe organizationId="org-1" authorizedScopeIds={['home-pool']} preferredScopeId="home-pool" /></ScopeProvider>)
    expect(await screen.findByLabelText('scope')).toHaveTextContent('home-pool')
    rerender(<ScopeProvider><Probe organizationId="org-1" authorizedScopeIds={['replacement-pool']} /></ScopeProvider>)
    await waitFor(() => expect(screen.getByLabelText('scope')).toHaveTextContent('replacement-pool'))
  })

  it('falls back to All only for an organization-wide principal', async () => {
    render(<ScopeProvider><Probe organizationId="org-1" authorizedScopeIds={['pool-1']} allowAll /></ScopeProvider>)
    expect(await screen.findByLabelText('scope')).toHaveTextContent('all')
  })
})