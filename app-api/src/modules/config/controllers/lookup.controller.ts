import { Controller, Get, Param, Query } from '@nestjs/common';
import type { LookupTypeDto, LookupValueDto } from '../../../contracts/lookup.contract';
import { LookupService } from '../services/lookup.service';

/**
 * Read surface for reference data — every dropdown in the app reads from here
 * (ADR-009). Values come back with both EN/AR labels; the client localises.
 * Admin CRUD is a governed `LookupService` method (invoked by the config admin
 * surface) and gains its HTTP endpoints when RBAC/auth lands — no unauthenticated
 * mutation endpoint is exposed.
 */
@Controller({ path: 'lookups', version: '1' })
export class LookupController {
  constructor(private readonly lookups: LookupService) {}

  /** Lists the lookup type catalogue. */
  @Get()
  listTypes(): Promise<LookupTypeDto[]> {
    return this.lookups.listTypes();
  }

  /** Active values for a type; `?tree=true` nests hierarchical/cascading values. */
  @Get(':typeCode')
  getValues(
    @Param('typeCode') typeCode: string,
    @Query('tree') tree?: string,
  ): Promise<LookupValueDto[]> {
    return this.lookups.getValues(typeCode, tree === 'true');
  }

  /** Cascading children of a parent value (e.g. models for a make). */
  @Get(':typeCode/:parentCode')
  getChildren(
    @Param('typeCode') typeCode: string,
    @Param('parentCode') parentCode: string,
  ): Promise<LookupValueDto[]> {
    return this.lookups.getChildren(typeCode, parentCode);
  }
}
