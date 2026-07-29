import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { VehicleOnboardingPage } from './vehicle-onboarding-page'

const mutateAsync = vi.fn()

const lookups: Record<string, Array<Record<string, unknown>>> = {
  'vehicle-acquisition-scenario': [
    {
      id: 'a1',
      code: 'LEASED',
      labelEn: 'Leased',
      labelAr: 'مؤجرة',
      descriptionEn: 'Lease',
      descriptionAr: 'تأجير',
      parentId: null,
      sortOrder: 0,
    },
    {
      id: 'a2',
      code: 'OWNED_NEW',
      labelEn: 'Owned - new purchase',
      labelAr: 'مملوكة - شراء جديد',
      descriptionEn: 'Purchase',
      descriptionAr: 'شراء',
      parentId: null,
      sortOrder: 1,
    },
    {
      id: 'a3',
      code: 'TRANSFER_IN',
      labelEn: 'Transfer in',
      labelAr: 'نقل داخلي',
      descriptionEn: 'Transfer an owned vehicle',
      descriptionAr: 'نقل مركبة مملوكة',
      parentId: null,
      sortOrder: 2,
    },
  ],
  'vehicle-operational-status': [
    {
      id: 'o1',
      code: 'ACTIVE',
      labelEn: 'Active',
      labelAr: 'نشطة',
      descriptionEn: null,
      descriptionAr: null,
      parentId: null,
      sortOrder: 0,
    },
    {
      id: 'o2',
      code: 'DECOMMISSIONED',
      labelEn: 'Decommissioned',
      labelAr: 'مسحوبة من الخدمة',
      descriptionEn: null,
      descriptionAr: null,
      parentId: null,
      sortOrder: 1,
    },
  ],
  'vehicle-telematics-setup': [
    {
      id: 't1',
      code: 'MANUAL',
      labelEn: 'No telematics - manual odometer',
      labelAr: 'بدون تتبع - عداد يدوي',
      descriptionEn: null,
      descriptionAr: null,
      parentId: null,
      sortOrder: 0,
    },
  ],
  currency: [
    {
      id: 'c1',
      code: 'AED',
      labelEn: 'UAE Dirham',
      labelAr: 'درهم إماراتي',
      descriptionEn: null,
      descriptionAr: null,
      parentId: null,
      sortOrder: 0,
    },
  ],
  'ownership-type': [
    {
      id: 'ow1',
      code: 'OWNED',
      labelEn: 'Owned',
      labelAr: 'مملوكة',
      descriptionEn: null,
      descriptionAr: null,
      parentId: null,
      sortOrder: 0,
    },
  ],
  'vehicle-body-type': [
    {
      id: 'b1',
      code: 'SUV',
      labelEn: 'SUV',
      labelAr: 'دفع رباعي',
      descriptionEn: null,
      descriptionAr: null,
      parentId: null,
      sortOrder: 0,
    },
  ],
  'use-category': [
    {
      id: 'u1',
      code: 'POOL',
      labelEn: 'Pool',
      labelAr: 'مجمع',
      descriptionEn: null,
      descriptionAr: null,
      parentId: null,
      sortOrder: 0,
    },
  ],
  'fuel-type': [
    {
      id: 'f1',
      code: 'PETROL',
      labelEn: 'Petrol',
      labelAr: 'بنزين',
      descriptionEn: null,
      descriptionAr: null,
      parentId: null,
      sortOrder: 0,
    },
  ],
  'vehicle-make': [
    {
      id: 'm1',
      code: 'TOYOTA',
      labelEn: 'Toyota',
      labelAr: 'تويوتا',
      descriptionEn: null,
      descriptionAr: null,
      parentId: null,
      sortOrder: 0,
    },
    {
      id: 'm2',
      code: 'FORTUNER',
      labelEn: 'Fortuner',
      labelAr: 'فورتشنر',
      descriptionEn: null,
      descriptionAr: null,
      parentId: 'm1',
      sortOrder: 0,
    },
  ],
}

vi.mock('@/features/config/hooks/use-lookups', () => ({
  useLookupValues: (typeCode: string) => ({
    data: lookups[typeCode] ?? [],
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/features/platform/hooks/use-hierarchy', () => ({
  useHierarchy: () => ({
    data: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        parentId: null,
        levelIndex: 0,
        levelLabel: 'Pool',
        name: 'GS Pool',
        path: 'root',
        children: [],
      },
    ],
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({
    me: {
      roles: [
        {
          role: 'FleetManager',
          scopeNodeId: '10000000-0000-4000-8000-000000000001',
        },
      ],
    },
  }),
}))

vi.mock('./hooks/use-vehicles', () => ({
  useCreateVehicle: () => ({ mutateAsync, isPending: false }),
}))

vi.mock('@/features/vendors/hooks/use-vendors', () => ({
  useVendors: () => ({
    data: [
      {
        id: '30000000-0000-4000-8000-000000000001',
        legalName: 'Governed Leasing LLC',
        status: 'Active',
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useVendorLeases: () => ({
    data: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        contractRef: 'LC-GOV-001',
        status: 'Active',
        endDate: '2999-12-31',
      },
    ],
    isLoading: false,
    isError: false,
  }),
}))

function renderPage(language = 'en') {
  void i18n.changeLanguage(language)
  return render(
    <MemoryRouter initialEntries={[`/${language}/vehicles/onboard`]}>
      <Routes>
        <Route
          path=":lang/vehicles/onboard"
          element={<VehicleOnboardingPage />}
        />
        <Route path=":lang/vehicles/:id" element={<div>vehicle detail</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue({
    id: '20000000-0000-4000-8000-000000000001',
    bookingPoolFlag: false,
  })
})

describe('VehicleOnboardingPage', () => {
  it('renders acquisition options from lookup data', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: /Leased/ })).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Owned - new purchase/ }),
    ).toBeVisible()
  })

  it('uses Arabic labels returned by lookups', async () => {
    renderPage('ar')
    expect(await screen.findByRole('button', { name: /مؤجرة/ })).toBeVisible()
    expect(
      screen.getByRole('button', { name: /مملوكة - شراء جديد/ }),
    ).toBeVisible()
  })

  it('submits governed vendor and lease identifiers for a leased vehicle', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('combobox', { name: 'Vendor' }))
    await user.click(
      await screen.findByRole('option', { name: 'Governed Leasing LLC' }),
    )
    await user.click(screen.getByRole('combobox', { name: 'Lease contract' }))
    await user.click(await screen.findByRole('option', { name: 'LC-GOV-001' }))
    fireEvent.change(screen.getByLabelText('Monthly rental'), {
      target: { value: '3150' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-08-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2027-08-01' },
    })
    await user.click(screen.getByRole('button', { name: /Continue/ }))

    fireEvent.change(screen.getByPlaceholderText('VIN / chassis number'), {
      target: { value: 'VIN-LEASED-1' },
    })
    fireEvent.change(screen.getByLabelText('Plate'), {
      target: { value: 'AD 30003' },
    })
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(
      screen.getByRole('button', { name: /Create blocked record/ }),
    )

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        ownership: 'Leased',
        vendorId: '30000000-0000-4000-8000-000000000001',
        leaseContractId: '40000000-0000-4000-8000-000000000001',
      }),
    )
  })

  it('submits lookup codes and hierarchy id to the Vehicle API', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /Owned - new purchase/ }),
    )
    await user.click(screen.getByRole('button', { name: /Continue/ }))

    fireEvent.change(screen.getByPlaceholderText('VIN / chassis number'), {
      target: { value: 'VIN-LOOKUP-1' },
    })
    fireEvent.change(screen.getByLabelText('Plate'), {
      target: { value: 'AD 10001' },
    })
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(
      screen.getByRole('button', { name: /Create blocked record/ }),
    )

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyTypeCode: 'SUV',
        makeCode: 'TOYOTA',
        modelCode: 'FORTUNER',
        useCategoryCode: 'POOL',
        fuelTypeCode: 'PETROL',
        ownership: 'Owned',
        homeNodeId: '10000000-0000-4000-8000-000000000001',
        bookingPoolFlag: false,
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Vehicle created' }),
    ).toBeVisible()
    expect(screen.getByText('Onboard another vehicle')).toBeVisible()
  })

  it('submits a transferred-in vehicle as owned without lease identifiers', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Transfer in/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))

    fireEvent.change(screen.getByPlaceholderText('VIN / chassis number'), {
      target: { value: 'VIN-TRANSFER-1' },
    })
    fireEvent.change(screen.getByLabelText('Plate'), {
      target: { value: 'AD 40004' },
    })
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(
      screen.getByRole('button', { name: /Create blocked record/ }),
    )

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    const payload = mutateAsync.mock.calls[0][0]
    expect(payload).toEqual(expect.objectContaining({ ownership: 'Owned' }))
    expect(payload).not.toHaveProperty('vendorId')
    expect(payload).not.toHaveProperty('leaseContractId')
  })

  it('blocks submission when the operational status has no supported mapping', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /Owned - new purchase/ }),
    )
    await user.click(screen.getByRole('button', { name: /Continue/ }))

    fireEvent.change(screen.getByPlaceholderText('VIN / chassis number'), {
      target: { value: 'VIN-UNSUPPORTED-1' },
    })
    fireEvent.change(screen.getByLabelText('Plate'), {
      target: { value: 'AD 20002' },
    })
    await user.click(screen.getByRole('button', { name: /Continue/ }))

    await user.click(screen.getByRole('button', { name: /Decommissioned/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(
      screen.getByRole('button', { name: /Create blocked record/ }),
    )

    expect(mutateAsync).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: 'Vehicle created' }),
    ).not.toBeInTheDocument()
  })
})
