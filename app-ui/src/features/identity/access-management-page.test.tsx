import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ConfirmProvider } from '@/hooks/use-confirm'
import { AccessManagementPage } from './access-management-page'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ConfirmProvider>
        <AccessManagementPage />
      </ConfirmProvider>
    </QueryClientProvider>,
  )
}

describe('AccessManagementPage', () => {
  it('renders the KPI summary tiles and the enriched user grid', async () => {
    renderPage()
    // KPI tiles from the summary endpoint.
    expect(await screen.findByText('Employees')).toBeVisible()
    expect(await screen.findByText('214')).toBeVisible()
    // Enriched directory rows: name, role chip, cluster.
    expect(await screen.findByText('Aisha Rahman')).toBeVisible()
    expect(screen.getByText('Omar Al Blooshi')).toBeVisible()
    // People with no login still appear (directory is person-driven, not account-driven).
    expect(screen.getByText('Sultan Al Nuaimi')).toBeVisible()
    expect(screen.getByText('Khalid Rashed')).toBeVisible()
    expect(screen.getAllByText('FleetManager').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ports Cluster').length).toBeGreaterThan(0)
  })

  it('opens the manage-user right sheet on row click with current roles + assign form', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('Aisha Rahman'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Current roles')).toBeVisible()
    expect(within(sheet).getByText('Assign a role')).toBeVisible()
    // The user's existing assignment can be revoked (needs the assignmentId).
    expect(await within(sheet).findByRole('button', { name: /Revoke FleetManager/ })).toBeVisible()
    // Scope chips include the group-wide option.
    expect(await within(sheet).findByRole('button', { name: /Group-wide/ })).toBeVisible()
  })

  it('shows the suspend action for an active account in the sheet', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('Aisha Rahman'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('button', { name: 'Suspend account' })).toBeVisible()
  })

  it('offers a scoped role assignment for a linked account', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('Aisha Rahman'))
    const sheet = await screen.findByRole('dialog')
    // Save is disabled until a role + scope are chosen.
    expect(within(sheet).getByRole('button', { name: 'Save assignment' })).toBeDisabled()
  })
})
