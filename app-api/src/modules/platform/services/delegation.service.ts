import { Injectable } from '@nestjs/common';
import type { CreateDelegation } from '../../../contracts/platform.contract';
import { PlatformRepository } from '../repositories/platform.repository';

@Injectable()
export class DelegationService {
  constructor(private readonly repo: PlatformRepository) {}

  /** Creates a time-boxed, one-hop delegation of approval authority. */
  async create(input: CreateDelegation, delegatorPersonId: string) {
    return this.repo.insertDelegation({
      delegatorPersonId,
      delegatePersonId: input.delegatePersonId,
      requestType: input.requestType,
      validFrom: new Date(input.validFrom),
      validTo: new Date(input.validTo),
    });
  }
}
