import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ConfirmProvider } from '@/hooks/use-confirm'
import { ReferenceDataPage } from './reference-data-page'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ConfirmProvider>
        <ReferenceDataPage />
      </ConfirmProvider>
    </QueryClientProvider>,
  )
}

describe('ReferenceDataPage', () => {
  it("lists lookup types and the first type's values (from the real contract shape)", async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: /Vehicle body type/ })).toBeVisible()
    // Default selection = first type → its bilingual values render.
    expect(await screen.findByText('Sedan')).toBeVisible()
    expect(screen.getByText('سيدان')).toBeVisible()
    // Enriched columns from the admin DTO: usage count + status chip.
    expect(screen.getByText(/12 vehicles/)).toBeVisible()
    expect(screen.getByText('Retiring')).toBeVisible()
  })

  it('switches the values table when another type is selected', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Fuel type/ }))
    expect(await screen.findByText('Electric')).toBeVisible()
    expect(screen.getByText('كهربائي')).toBeVisible()
  })

  it('opens the add-value sheet in a right-side panel', async () => {
    renderPage()
    await screen.findByRole('button', { name: /Vehicle body type/ })
    fireEvent.click(screen.getByRole('button', { name: /add value/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Code')).toBeVisible()
    expect(within(dialog).getByLabelText('Label (EN)')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Add value' })).toBeVisible()
  })

  it('adds a value and closes the sheet on success (mutation → real contract)', async () => {
    renderPage()
    await screen.findByRole('button', { name: /Vehicle body type/ })
    fireEvent.click(screen.getByRole('button', { name: /add value/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'VAN' } })
    fireEvent.change(within(dialog).getByLabelText('Label (EN)'), { target: { value: 'Van' } })
    fireEvent.change(within(dialog).getByLabelText('Label (AR)'), { target: { value: 'فان' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add value' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('exposes the "New type" action to manage the catalogue', async () => {
    renderPage()
    await screen.findByRole('button', { name: /Vehicle body type/ })
    fireEvent.click(screen.getByRole('button', { name: /new type/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('New lookup type')).toBeVisible()
  })

  it('offers a child-TYPE chooser (Model + same list) on a self-hierarchical make', async () => {
    renderPage()
    // Select the (non-system) Vehicle make type via its unique code text.
    fireEvent.click((await screen.findByText('vehicle-make')).closest('button') as HTMLElement)
    expect(await screen.findByText('Toyota')).toBeVisible()
    // "+ Child" on Toyota is a chooser: a child TYPE (Model) + self-nest option.
    const trigger = screen.getByRole('button', { name: /Add child under TOYOTA/i })
    fireEvent.pointerDown(trigger, { button: 0 })
    fireEvent.pointerUp(trigger, { button: 0 })
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Vehicle model')).toBeVisible()
    expect(within(menu).getByText(/same list/i)).toBeVisible()
  })

  it('creates a child in the CHOSEN child type with the parent locked', async () => {
    renderPage()
    fireEvent.click((await screen.findByText('vehicle-make')).closest('button') as HTMLElement)
    await screen.findByText('Toyota')
    const trigger = screen.getByRole('button', { name: /Add child under TOYOTA/i })
    fireEvent.pointerDown(trigger, { button: 0 })
    fireEvent.pointerUp(trigger, { button: 0 })
    const menu = await screen.findByRole('menu')
    fireEvent.click(within(menu).getByText('Vehicle model'))
    const dialog = await screen.findByRole('dialog')
    // Sheet targets the Vehicle model type and locks the parent to TOYOTA.
    expect(within(dialog).getByText('Add child value')).toBeVisible()
    expect(within(dialog).getAllByText(/TOYOTA/).length).toBeGreaterThan(0)
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'COROLLA' } })
    fireEvent.change(within(dialog).getByLabelText('Label (EN)'), { target: { value: 'Corolla' } })
    fireEvent.change(within(dialog).getByLabelText('Label (AR)'), { target: { value: 'كورولا' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add value' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('hides "+ Child" for a flat type with no child types', async () => {
    renderPage()
    // Fuel type is flat (no child types, not self-hierarchical).
    fireEvent.click(await screen.findByRole('button', { name: /Fuel type/ }))
    expect(await screen.findByText('Petrol')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Add child under/i })).toBeNull()
  })

  it('shows cross-type children with a type tag when a make value is expanded', async () => {
    renderPage()
    fireEvent.click((await screen.findByText('vehicle-make')).closest('button') as HTMLElement)
    const toyotaRow = (await screen.findByText('Toyota')).closest('tr') as HTMLElement
    fireEvent.click(within(toyotaRow).getByRole('button', { name: /Expand children/i }))
    // The Model value Corolla appears under Toyota, tagged with its own type.
    expect(await screen.findByText('Corolla')).toBeVisible()
    expect(screen.getAllByText('Vehicle model').length).toBeGreaterThan(0)
  })
})
