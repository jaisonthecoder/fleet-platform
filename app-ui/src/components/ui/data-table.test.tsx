import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnDef } from '@tanstack/react-table'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from './data-table'

interface Row {
  model: string
  plate: string
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'model', header: 'Vehicle' },
  { accessorKey: 'plate', header: 'Plate' },
]

const data: Row[] = [
  { model: 'Land Cruiser', plate: 'AD 40213' },
  { model: 'Patrol', plate: 'AD 88914' },
  { model: 'Hiace', plate: 'AD 55102' },
]

describe('DataTable', () => {
  it('renders rows and filters via the global search', async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search…"
        pageSize={10}
      />,
    )
    expect(screen.getByText('Land Cruiser')).toBeVisible()
    expect(screen.getByText('Patrol')).toBeVisible()

    await user.type(screen.getByPlaceholderText('Search…'), 'Hiace')
    expect(screen.getByText('Hiace')).toBeVisible()
    expect(screen.queryByText('Land Cruiser')).not.toBeInTheDocument()
  })

  it('paginates when data exceeds the page size', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} data={data} pageSize={2} />)
    expect(screen.getByText('Land Cruiser')).toBeVisible()
    expect(screen.queryByText('Hiace')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to next page' }))
    expect(screen.getByText('Hiace')).toBeVisible()
  })

  it('drives pagination from props in manual (server) mode', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        manual
        total={30}
        page={1}
        pageSize={10}
        onPageChange={onPageChange}
      />,
    )
    // Footer count reflects the server total, not the page's row count.
    expect(screen.getByText(/1–10 of 30/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Go to next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})
