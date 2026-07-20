import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import { eligibilityRequestSchema, raiseBlockSchema } from '../../../contracts/compliance.contract';
import { ComplianceService } from '../services/compliance.service';
import { EligibilityService } from '../services/eligibility.service';

const actorRef = (p?: Principal): string => p?.personId ?? p?.entraObjectId ?? 'system';
const BLOCK_ROLES = ['HSE', 'InternalAudit', 'FleetManager', 'SystemAdmin'] as const;

/** Compliance + eligibility gate API (M7). */
@Controller({ version: '1' })
export class ComplianceController {
  constructor(
    private readonly eligibility: EligibilityService,
    private readonly compliance: ComplianceService,
  ) {}

  /** The single "can this driver take this vehicle now?" verdict. */
  @Post('eligibility')
  evaluate(@Body() body: unknown) {
    const parsed = eligibilityRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ title: 'Invalid eligibility request', reasons: parsed.error.issues.map((i) => i.message) });
    }
    return this.eligibility.evaluate(parsed.data);
  }

  @Get('compliance/expiries')
  expiries() {
    return this.compliance.listExpiries();
  }

  @Get('compliance/blocks')
  blocks() {
    return this.compliance.listBlocks();
  }

  @Roles(...BLOCK_ROLES)
  @Post('compliance/blocks')
  raiseBlock(@Body() body: unknown, @CurrentUser() p: Principal) {
    const parsed = raiseBlockSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ title: 'Invalid block', reasons: parsed.error.issues.map((i) => i.message) });
    }
    return this.compliance.raiseBlock(parsed.data, actorRef(p));
  }

  @Roles(...BLOCK_ROLES)
  @Post('compliance/blocks/:id/lift')
  liftBlock(@Param('id') id: string, @CurrentUser() p: Principal) {
    return this.compliance.liftBlock(id, actorRef(p));
  }
}
