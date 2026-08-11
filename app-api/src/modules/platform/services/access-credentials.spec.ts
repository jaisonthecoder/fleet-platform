import { AccessService } from './access.service';
import type { PlatformRepository } from '../repositories/platform.repository';
import type { AuditService } from './audit.service';

const personRow = {
  id: 'p1',
  organizationId: 'org1',
  licenceNumber: null,
  licenceExpiry: null,
  licenceSource: null,
  licenceVerified: false,
  emiratesId: null,
  emiratesIdExpiry: null,
  emiratesIdSource: null,
  emiratesIdVerified: false,
};

function makeService() {
  const repo = {
    findPerson: jest.fn().mockResolvedValue(personRow),
    updatePersonCredentials: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new AccessService(
    repo as unknown as PlatformRepository,
    audit as unknown as AuditService,
  );
  return { service, repo, audit };
}

describe('AccessService credential capture', () => {
  it('self-service marks source=manual and stays Unverified', async () => {
    const { service, repo, audit } = makeService();
    await service.updateMyCredentials('p1', {
      licenceNumber: 'L-9',
      licenceExpiry: '2030-01-01',
    });
    expect(repo.updatePersonCredentials).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        licenceNumber: 'L-9',
        licenceExpiry: '2030-01-01',
        licenceSource: 'manual',
        licenceVerified: false,
        licenceUpdatedByPersonId: 'p1',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PERSON_CREDENTIALS_UPDATED',
        after: { fields: ['licence'], verified: false, self: true },
      }),
    );
  });

  it('admin capture marks Verified and records the actor', async () => {
    const { service, repo, audit } = makeService();
    await service.updatePersonCredentials(
      'p1',
      { emiratesId: '784-1990-1', emiratesIdExpiry: '2029-05-01' },
      'admin-1',
    );
    expect(repo.updatePersonCredentials).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        emiratesId: '784-1990-1',
        emiratesIdSource: 'manual',
        emiratesIdVerified: true,
        emiratesIdUpdatedByPersonId: 'admin-1',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: { fields: ['emiratesId'], verified: true, self: false },
      }),
    );
  });
});
