import { useEffect, useImperativeHandle } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { HandoverCapturePage } from './handover-capture-page'
import type { HandoverCaptureContext } from './handover.contract'

vi.mock('@/features/auth/auth-context', () => ({ useAuth: () => ({ me: { personId: FLEET_ID, fullName: 'Khalid Rashed' } }) }))
vi.mock('@/hooks/use-confirm', () => ({ useConfirm: () => async () => true }))
vi.mock('@/hooks/use-toast', () => ({ notify: { ok: vi.fn(), danger: vi.fn() } }))
vi.mock('@/components/patterns/signature-pad', () => ({
  SignaturePad: ({ ref, onSignedChange }: { ref: React.Ref<{ getValue: () => { mode: 'type'; value: string } }>; onSignedChange?: (signed: boolean) => void }) => {
    useImperativeHandle(ref, () => ({ getValue: () => ({ mode: 'type' as const, value: 'Amina Khoury' }), clear: () => undefined, toDataURL: () => null, isSigned: () => true }))
    useEffect(() => onSignedChange?.(true), [onSignedChange])
    return <div aria-label="Signature pad">Signature ready</div>
  },
}))

const BOOKING_ID = '10000000-0000-4000-8000-000000000001'
const VEHICLE_ID = '20000000-0000-4000-8000-000000000001'
const DRIVER_ID = '30000000-0000-4000-8000-000000000001'
const FLEET_ID = '40000000-0000-4000-8000-000000000001'
const SCOPE_ID = '50000000-0000-4000-8000-000000000001'
const EVIDENCE_ID = '60000000-0000-4000-8000-000000000001'
const HANDOVER_ID = '70000000-0000-4000-8000-000000000001'

const baseCaptureContext: HandoverCaptureContext = {
  schemaVersion: 2,
  booking: { id: BOOKING_ID, number: 'BK-1204', revision: 4, status: 'Approved', pickupAtUtc: '2026-08-01T08:00:00.000Z', returnAtUtc: '2026-08-01T10:00:00.000Z' },
  vehicle: { id: VEHICLE_ID, plate: 'AD 88914', makeCode: 'NISSAN', modelCode: 'PATROL' },
  driver: { personId: DRIVER_ID, fullName: 'Amina Khoury' },
  scope: { nodeId: SCOPE_ID, name: 'GS Pool' },
  consent: { version: 'v3.2', signedAtUtc: '2026-08-01T07:55:00.000Z' },
  eligibility: { status: 'VERIFIED', reasonCodes: [], evaluatedAtUtc: '2026-08-01T07:54:00.000Z' },
  telematics: { status: 'MATCHED', odometer: '48213', observedAtUtc: '2026-08-01T07:59:00.000Z' },
  handover: null,
  carriedDamage: [],
  capabilities: { handover: true, return: false, amendOpenCustody: false },
}
let captureContext = baseCaptureContext

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([
    { path: '/:lang/handover/work', element: <HandoverCapturePage /> },
    { path: '/:lang/handover', element: <div>Register</div> },
  ], { initialEntries: [`/en/handover/work?bookingId=${BOOKING_ID}`] })
  return { ...render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>), router }
}

describe('HandoverCapturePage', () => {
  beforeEach(async () => {
    captureContext = baseCaptureContext
    await i18n.changeLanguage('en')
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => ({ fillStyle: '', font: '', textAlign: '', fillRect: vi.fn(), fillText: vi.fn() }) })
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', { configurable: true, value: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })) })
    server.use(http.get('*/api/v1/handovers/capture-context', () => HttpResponse.json(captureContext)))
  })

  it('renders every demo inspection with independent PASS and FAIL controls', async () => {
    renderPage()
    expect(await screen.findByText('BK-1204')).toBeVisible()
    for (const label of ['Body panels & glass', 'Tyres & spare', 'Lights & indicators', 'On-vehicle assets', 'Cabin condition']) {
      expect(screen.getByText(label)).toBeVisible()
    }
    expect(screen.getAllByRole('button', { name: 'PASS' })).toHaveLength(5)
    expect(screen.getAllByRole('button', { name: 'FAIL' })).toHaveLength(5)
    expect(screen.getByLabelText('Tap the vehicle to mark damage')).toBeVisible()
    expect(screen.getByLabelText('Signature pad')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Handover baseline → Return comparison' })).not.toBeInTheDocument()
  })

  it('stages signature evidence and submits the exact V2 Handover command', async () => {
    const commands: Array<{ body: Record<string, unknown>; key: string | null }> = []
    server.use(
      http.post('*/api/v1/handover-evidence/uploads', () => HttpResponse.json({ id: EVIDENCE_ID, evidenceRef: EVIDENCE_ID, evidenceType: 'Signature', status: 'Staged', contentHash: 'a'.repeat(64), mimeType: 'image/png', sizeBytes: 3, expiresAtUtc: '2026-08-01T12:00:00.000Z' })),
      http.post('*/api/v1/handovers', async ({ request }) => {
        commands.push({ body: await request.json() as Record<string, unknown>, key: request.headers.get('idempotency-key') })
        return HttpResponse.json({ schemaVersion: 2, id: HANDOVER_ID, bookingId: BOOKING_ID, vehicleId: VEHICLE_ID, driverPersonId: DRIVER_ID, phase: 'Handover', handoverAtUtc: '2026-08-01T08:00:00.000Z', startOdometer: '48213', startFuelEighths: 8, gpsStatus: 'MATCHED', keyIssueRef: 'KEY-01', offlineCaptured: false, returnAtUtc: null, endOdometer: null, endFuelEighths: null, returnCondition: null, keyReturnRef: null, expectedFuelConsumedLitres: null, actualFuelConsumedLitres: null, fuelDeviationPercent: null, fuelDeviationFlagged: false, odometerConflict: false, lateReturn: false, damage: [] })
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('BK-1204')
    for (const button of screen.getAllByRole('button', { name: 'PASS' })) await user.click(button)
    await user.type(screen.getByPlaceholderText('Issued key reference'), 'KEY-01')
    await user.click(screen.getByRole('button', { name: 'Confirm key issue' }))
    await user.click(screen.getByRole('button', { name: 'Hand over keys' }))

    await waitFor(() => expect(commands).toHaveLength(1))
    expect(commands[0]?.body).toMatchObject({ schemaVersion: 2, bookingId: BOOKING_ID, employeePersonId: DRIVER_ID, expectedBookingRevision: 4, startOdometer: 48213, keyIssueRef: 'KEY-01', signatureEvidenceRef: EVIDENCE_ID, releaseLocationNodeId: SCOPE_ID })
    expect(commands[0]?.body.inspection).toHaveLength(5)
    expect(commands[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('requires a failure note and staged photo before a failed inspection is ready', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('BK-1204')
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[0]!)
    expect(screen.getByPlaceholderText('Describe the failed inspection')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Evidence 0' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Hand over keys' })).toBeDisabled()
  })

  it('renders Return mode against immutable carried-damage and Handover revision evidence', async () => {
    captureContext = {
      ...baseCaptureContext,
      booking: { ...baseCaptureContext.booking, status: 'Active', revision: 5 },
      handover: { id: HANDOVER_ID, revision: 2, phase: 'Handover', issuedAtUtc: '2026-08-01T08:00:00.000Z', startOdometer: '48000', startFuelEighths: 7, keyIssueRef: 'KEY-01', releaseLocation: { nodeId: SCOPE_ID, code: 'GS', name: 'GS Pool' } },
      carriedDamage: [{ id: EVIDENCE_ID, x: 0.24, y: 0.22, region: 'front-left-wing', templateVersion: 1, photoRef: null, note: 'Existing scratch', state: 'existing', atUtc: '2026-07-31T08:00:00.000Z' }],
      capabilities: { handover: false, return: true, amendOpenCustody: true },
    }
    renderPage()
    expect(await screen.findByRole('tab', { name: 'Return' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Return vehicle' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Handover baseline → Return comparison' })).toBeVisible()
    expect(screen.getByText('48000 km')).toBeVisible()
    expect(screen.getByText('KEY-01')).toBeVisible()
    expect(screen.getByText('Append-only baseline')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Return walkaround inspection' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Damage 1 (existing)' })).toBeVisible()
    expect(screen.getByText('Existing mark · previous Booking')).toBeVisible()
    expect(screen.getByText('Return condition')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirm return' })).toBeDisabled()
  })

  it('blocks route changes after capture work until the user explicitly discards it', async () => {
    const user = userEvent.setup()
    const { router } = renderPage()
    await screen.findByText('BK-1204')
    await user.click(screen.getAllByRole('button', { name: 'PASS' })[0]!)
    void router.navigate('/en/handover')
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard custody evidence?')
    await user.click(screen.getByRole('button', { name: 'Stay' }))
    expect(router.state.location.pathname).toBe('/en/handover/work')
    void router.navigate('/en/handover')
    await user.click(await screen.findByRole('button', { name: 'Discard and leave' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/en/handover'))
  })
})
