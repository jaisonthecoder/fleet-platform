#!/usr/bin/env node
import process from 'node:process';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
const DEMO_COUNT = 10;
const REQUIRED_DOCUMENTS = [
  ['TRADE_LICENCE', true],
  ['LIABILITY_INSURANCE', true],
  ['MASTER_SERVICE_AGREEMENT', false],
];

/** Calls one JSON API endpoint and surfaces problem-detail reasons on failure. */
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const reasons = Array.isArray(body?.reasons)
      ? `: ${body.reasons.join(', ')}`
      : '';
    throw new Error(
      `${options.method ?? 'GET'} ${path} failed (${response.status}) ${body?.title ?? ''}${reasons}`,
    );
  }
  return body;
}

/** Returns the seeded development principal holding one required role. */
function requireActor(users, role) {
  const actor = users.find((user) =>
    user.roles.some((assignment) => assignment.role === role),
  );
  if (!actor) throw new Error(`No seeded ${role} principal is available`);
  return actor;
}

/** Flattens an organization hierarchy into a stable depth-first list. */
function flattenHierarchy(nodes) {
  return nodes.flatMap((node) => [
    node,
    ...flattenHierarchy(Array.isArray(node.children) ? node.children : []),
  ]);
}

/** Creates or completes one governed active demo Vendor and usable lease. */
async function ensureVendor(index, actors, poolId, existingVendors) {
  const number = String(index).padStart(2, '0');
  const legalName = `Demo Fleet Vendor ${number}`;
  const adminHeaders = { 'x-dev-person-id': actors.admin.personId };
  const procurementHeaders = {
    'x-dev-person-id': actors.procurement.personId,
  };
  let vendor = existingVendors.find((item) => item.legalName === legalName);
  if (!vendor) {
    vendor = await api('/vendors', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        legalName,
        tradeName: `Demo Mobility ${number}`,
        tradeLicenceNumber: `DEMO-CN-${number}`,
        tradeLicenceEmirate: 'Abu Dhabi',
        taxRegistrationNumber: `1000000000000${number}`,
        categoryCode: 'LESSOR',
        primaryContactName: `Demo Contact ${number}`,
        primaryContactRole: 'Fleet Account Manager',
        primaryContactEmail: `vendor${number}@demo.example`,
        primaryContactPhone: `+9715000000${number}`,
        paymentTerms: 'Net 45',
        currency: 'AED',
        bankIban: `AE0703312345678901234${number}`,
        sourceMode: 'Manual',
        notes: 'Development demo Vendor linked to one demo leased Vehicle.',
      }),
    });
    existingVendors.push(vendor);
  }
  if (vendor.status === 'Retired') {
    throw new Error(`${legalName} is Retired and cannot be reused`);
  }

  await api(`/vendors/${vendor.id}/onboarding`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      standardOffHireNoticeDays: 30,
      earlyTerminationPenalty: 'AED 4,500 per vehicle',
      renewalOptions: '2 x 12 months',
      escalationClause: 'CPI-linked, capped at 3% annually',
      replacementClause: 'Like-for-like replacement within 48 hours',
      alertLadder: '90/60/30',
      accessMode: 'ManualInternal',
    }),
  });

  const documents = await api(`/vendors/${vendor.id}/documents`, {
    headers: adminHeaders,
  });
  for (const [documentTypeCode, tracksExpiry] of REQUIRED_DOCUMENTS) {
    let document = documents.find(
      (item) =>
        item.documentTypeCode === documentTypeCode &&
        item.status === 'Confirmed',
    );
    if (!document) {
      document = documents.find(
        (item) =>
          item.documentTypeCode === documentTypeCode &&
          ['Uploaded', 'PendingConfirmation'].includes(item.status),
      );
    }
    if (!document) {
      document = await api(`/vendors/${vendor.id}/documents`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          documentTypeCode,
          documentReference: `DEMO-${documentTypeCode}-${number}`,
          blobRef: `vendor-documents/${vendor.id}/${documentTypeCode.toLowerCase()}-demo.pdf`,
          ...(tracksExpiry
            ? { issueDate: '2026-01-01', expiryDate: '2030-12-31' }
            : {}),
        }),
      });
    }
    if (document.status !== 'Confirmed') {
      await api(`/vendors/${vendor.id}/documents/${document.id}/confirm`, {
        method: 'POST',
        headers: procurementHeaders,
        body: JSON.stringify({
          confirmedMetadata: { demoSeed: true, manuallyConfirmed: true },
        }),
      });
    }
  }

  if (vendor.status === 'Draft') {
    vendor = await api(`/vendors/${vendor.id}/submit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reason: 'Demo seed ready for approval' }),
    });
  }
  if (vendor.status === 'PendingApproval') {
    vendor = await api(`/vendors/${vendor.id}/approve`, {
      method: 'POST',
      headers: procurementHeaders,
      body: JSON.stringify({ reason: 'Approved development demo Vendor' }),
    });
  }
  if (vendor.status === 'Suspended') {
    vendor = await api(`/vendors/${vendor.id}/reactivate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reason: 'Demo evidence is current' }),
    });
  }
  if (vendor.status !== 'Active') {
    throw new Error(`${legalName} did not reach Active status`);
  }

  const contractRef = `DEMO-LC-${number}`;
  const leases = await api(`/vendors/${vendor.id}/lease-contracts`, {
    headers: adminHeaders,
  });
  let lease = leases.find((item) => item.contractRef === contractRef);
  if (!lease) {
    lease = await api(`/vendors/${vendor.id}/lease-contracts`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        contractRef,
        scopeNodeId: poolId,
        monthlyAmount: String(3000 + index * 125),
        currency: 'AED',
        startDate: '2026-01-01',
        endDate: '2030-12-31',
        offHireNoticeDays: 30,
        earlyTerminationPenalty: 'AED 4,500 per vehicle',
        renewalOptions: '2 x 12 months',
        escalationClause: 'CPI-linked, capped at 3% annually',
        replacementClause: 'Like-for-like replacement within 48 hours',
        alertLadder: '90/60/30',
      }),
    });
  }
  if (!['Active', 'ExpiringSoon'].includes(lease.status)) {
    lease = await api(`/vendors/lease-contracts/${lease.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'Active', endDate: '2030-12-31' }),
    });
  }
  return { vendor, lease };
}

/** Creates one compliant leased Vehicle linked to the supplied Vendor lease. */
async function ensureVehicle(index, vendor, lease, poolId, existingVehicles, admin) {
  const number = String(index).padStart(2, '0');
  const plate = `DEMO-${number}`;
  let vehicle = existingVehicles.find((item) => item.plate === plate);
  if (vehicle) return vehicle;
  const variants = [
    ['TOYOTA', 'LANDCRUISER', 'SUV', 'PETROL'],
    ['TOYOTA', 'HILUX', 'PICKUP', 'DIESEL'],
    ['NISSAN', 'PATROL', 'SUV', 'PETROL'],
    ['MITSUBISHI', 'PAJERO', 'SUV', 'PETROL'],
  ];
  const [makeCode, modelCode, bodyTypeCode, fuelTypeCode] =
    variants[(index - 1) % variants.length];
  vehicle = await api('/vehicles', {
    method: 'POST',
    headers: { 'x-dev-person-id': admin.personId },
    body: JSON.stringify({
      plate,
      chassisVin: `DEMO-VIN-2026-${number}`,
      bodyTypeCode,
      makeCode,
      modelCode,
      year: 2026,
      colour: index % 2 ? 'White' : 'Silver',
      useCategoryCode: 'POOL',
      seatingCapacity: bodyTypeCode === 'PICKUP' ? 5 : 7,
      fuelTypeCode,
      fuelEfficiencyKmpl: bodyTypeCode === 'PICKUP' ? '10.5' : '8.5',
      ownership: 'Leased',
      purchaseOrLeaseStart: '2026-01-01',
      leaseEnd: '2030-12-31',
      monthlyRental: lease.monthlyAmount ?? String(3000 + index * 125),
      currency: 'AED',
      vendorId: vendor.id,
      leaseContractId: lease.id,
      mulkiyaNumber: `DEMO-REG-${number}`,
      mulkiyaExpiry: '2030-12-31',
      insuranceProvider: 'Demo Insurance PJSC',
      insurancePolicyNumber: `DEMO-POL-${number}`,
      insuranceExpiry: '2030-12-31',
      fuelCardNumber: `DEMO-FC-${number}`,
      salikTag: `DEMO-SLK-${number}`,
      darbTag: `DEMO-DRB-${number}`,
      operationalStatus: 'Standby',
      bookingPoolFlag: true,
      assignmentModel: 'Pool',
      gpsStatus: 'Online',
      trackerVendor: 'Demo Telematics',
      trackerSerial: `DEMO-GPS-${number}`,
      homeNodeId: poolId,
    }),
  });
  existingVehicles.push(vehicle);
  return vehicle;
}

/** Seeds ten governed Vendors, leases, and linked compliant Vehicles. */
async function main() {
  const users = await api('/dev/users');
  const actors = {
    admin: requireActor(users, 'SystemAdmin'),
    procurement: requireActor(users, 'Procurement'),
  };
  const organization = await api('/admin/organization', {
    headers: { 'x-dev-person-id': actors.admin.personId },
  });
  const pool = flattenHierarchy(organization.hierarchy).find(
    (node) => node.levelCode === 'POOL',
  );
  if (!pool) throw new Error('No active Pool hierarchy node is available');
  const existingVendors = await api('/vendors?limit=200', {
    headers: { 'x-dev-person-id': actors.admin.personId },
  });
  const existingVehicles = await api('/vehicles?limit=200', {
    headers: { 'x-dev-person-id': actors.admin.personId },
  });

  const seeded = [];
  for (let index = 1; index <= DEMO_COUNT; index += 1) {
    const { vendor, lease } = await ensureVendor(
      index,
      actors,
      pool.id,
      existingVendors,
    );
    const vehicle = await ensureVehicle(
      index,
      vendor,
      lease,
      pool.id,
      existingVehicles,
      actors.admin,
    );
    seeded.push({
      vendor: vendor.legalName,
      vendorStatus: vendor.status,
      lease: lease.contractRef,
      vehicle: vehicle.plate,
      pool: pool.name,
    });
  }
  console.table(seeded);
}

main().catch((error) => {
  console.error(`seed-demo-fleet: ${error.message}`);
  process.exit(1);
});