import { Controller, Get, Query } from '@nestjs/common';
import { PlatformRepository } from '../repositories/platform.repository';

@Controller({ version: '1' })
export class AuditController {
  constructor(private readonly repo: PlatformRepository) {}

  /** Read-only, paginated audit log (Internal Audit). */
  @Get('audit')
  audit(@Query('limit') limit = '50', @Query('offset') offset = '0') {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = Math.max(Number(offset) || 0, 0);
    return this.repo.listAudit(take, skip);
  }

  /** The standing SoD-override / exception report (FR-AUD-03). */
  @Get('reports/exceptions')
  exceptions() {
    return this.repo.listSodExceptions();
  }
}
