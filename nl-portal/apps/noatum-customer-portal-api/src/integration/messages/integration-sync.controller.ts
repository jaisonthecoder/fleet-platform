import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantRepository } from '../../common/tenancy/tenant.repository';
import {
  IntegrationSyncStatusDto,
  integrationMessageStatusFor,
} from '../../contracts/dto/integration-sync.dto';
import { PERMISSIONS } from '../../contracts/permissions';
import { TmsQuoteAdapter } from '../../contracts/adapters/tms-quote.adapter';

import { IntegrationMessageService } from './integration-message.service';

/**
 * C7: ask what happened to any message.
 *
 * Asked for by name by the product owner - the copy we send to CargoWise should
 * be answerable, and while the transport is held the honest answer is "pending".
 *
 * Staff-only. Whether a message is queued is our problem; showing it to a
 * customer would invite them to wait for something that has no bearing on their
 * quote.
 */
@ApiTags('integration')
@ApiBearerAuth()
@Controller('integration')
export class IntegrationSyncController {
  constructor(
    private readonly repo: TenantRepository,
    private readonly messages: IntegrationMessageService,
    private readonly quotes: TmsQuoteAdapter,
  ) {}

  @RequirePermission(PERMISSIONS.ADMIN_INTEGRATION_READ)
  @Get('sync/:portalRef')
  @ApiOperation({
    summary: 'Every message exchanged for one business reference, newest first',
  })
  @ApiOkResponse({ type: IntegrationSyncStatusDto })
  async status(@Param('portalRef') portalRef: string): Promise<IntegrationSyncStatusDto> {
    const rows = await this.repo.runInternal((tx) => this.messages.statusFor(tx, portalRef));

    return {
      portalRef,
      // Reported rather than inferred from an empty list: "nothing to send" and
      // "nowhere to send it" are different answers and staff need to tell them apart.
      transportConfigured: this.quotes.isConfigured(),
      messages: rows.map(integrationMessageStatusFor),
    };
  }
}
