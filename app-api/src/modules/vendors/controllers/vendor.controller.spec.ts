import { BadRequestException } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import { VendorService } from '../services/vendor.service';
import { VendorController } from './vendor.controller';

const principal: Principal = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: '10000000-0000-4000-8000-000000000001',
  personId: '20000000-0000-4000-8000-000000000001',
  entraObjectId: '30000000-0000-4000-8000-000000000001',
  email: 'procurement@example.test',
  roles: [],
  isDevLogin: false,
};

describe('VendorController list validation', () => {
  const vendors = {
    list: jest.fn(),
    createDocument: jest.fn(),
    confirmDocument: jest.fn(),
  };
  const controller = new VendorController(vendors as unknown as VendorService);

  beforeEach(() => {
    jest.clearAllMocks();
    vendors.list.mockResolvedValue([]);
  });

  it('rejects an invalid status before querying persistence', async () => {
    await expect(
      controller.list(principal, undefined, undefined, 'Bogus'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vendors.list).not.toHaveBeenCalled();
  });

  it('forwards a validated status within the principal organization', async () => {
    await expect(
      controller.list(principal, '25', '5', 'Active'),
    ).resolves.toEqual([]);
    expect(vendors.list).toHaveBeenCalledWith(
      25,
      5,
      principal.organizationId,
      'Active',
    );
  });

  it('parses and forwards a Vendor document create inside the principal organization', async () => {
    vendors.createDocument.mockResolvedValue({ id: 'document-1' });

    await expect(
      controller.createDocument(
        'vendor-1',
        {
          documentTypeCode: 'TRADE_LICENCE',
          documentReference: 'CN-100',
          blobRef: 'vendor-documents/vendor-1/CN-100.pdf',
          issueDate: '2026-01-01',
          expiryDate: '2027-01-01',
        },
        principal,
      ),
    ).resolves.toEqual({ id: 'document-1' });
    expect(vendors.createDocument).toHaveBeenCalledWith(
      'vendor-1',
      expect.objectContaining({ documentTypeCode: 'TRADE_LICENCE' }),
      principal.personId,
      principal.organizationId,
    );
  });

  it('rejects invalid Vendor document dates before service access', async () => {
    await expect(
      controller.createDocument(
        'vendor-1',
        {
          documentTypeCode: 'TRADE_LICENCE',
          blobRef: 'vendor-documents/vendor-1/CN-100.pdf',
          issueDate: '2027-01-01',
          expiryDate: '2026-01-01',
        },
        principal,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vendors.createDocument).not.toHaveBeenCalled();
  });

  it('rejects URL-like or embedded Vendor storage references', async () => {
    await expect(
      controller.createDocument(
        'vendor-1',
        {
          documentTypeCode: 'TRADE_LICENCE',
          blobRef: 'data:application/pdf;base64,AAAA',
        },
        principal,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vendors.createDocument).not.toHaveBeenCalled();
  });

  it('rejects client-supplied extracted metadata', async () => {
    await expect(
      controller.createDocument(
        'vendor-1',
        {
          documentTypeCode: 'TRADE_LICENCE',
          blobRef: 'vendor-documents/vendor-1/trade.pdf',
          extractedMetadata: { claimedOcr: true },
        },
        principal,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vendors.createDocument).not.toHaveBeenCalled();
  });

  it('forwards human document confirmation with the confirmer actor', async () => {
    vendors.confirmDocument.mockResolvedValue({ status: 'Confirmed' });

    await expect(
      controller.confirmDocument(
        'vendor-1',
        'document-1',
        { confirmedMetadata: { insurer: 'Example' } },
        principal,
      ),
    ).resolves.toEqual({ status: 'Confirmed' });
    expect(vendors.confirmDocument).toHaveBeenCalledWith(
      'vendor-1',
      'document-1',
      { confirmedMetadata: { insurer: 'Example' } },
      principal.personId,
      principal.organizationId,
    );
  });
});
