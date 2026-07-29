import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import { consentDomainSchema, createConsentTemplateSchema } from '../../../contracts/consent-administration.contract';
import { ConsentAdministrationService } from '../services/consent-administration.service';

@Roles('DataSteward', 'SystemAdmin')
@Controller({ path: 'admin/consents', version: '1' })
export class ConsentAdministrationController {
  constructor(private readonly consents: ConsentAdministrationService) {}

  /** Lists governed versions and their approval status. */
  @Get()
  list(@CurrentUser() principal: Principal, @Query('domain') domain?: string) {
    const parsed = domain ? consentDomainSchema.safeParse(domain) : null;
    if (parsed && !parsed.success) throw new BadRequestException({ title: 'Unknown consent domain', reasons: [`unknown-consent-domain:${domain}`] });
    return this.consents.list(principal, parsed?.success ? parsed.data : undefined);
  }

  /** Creates an immutable bilingual Draft. */
  @Post()
  create(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const parsed = createConsentTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ title: 'Invalid consent template', reasons: parsed.error.issues.map((issue) => issue.message) });
    return this.consents.create(parsed.data, principal);
  }

  /** Activates a Draft; this action represents organizational approval. */
  @Roles('SystemAdmin')
  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() principal: Principal) {
    return this.consents.activate(id, principal);
  }

  /** Retires Active wording and returns the domain to fail-closed state. */
  @Roles('SystemAdmin')
  @Post(':id/retire')
  retire(@Param('id') id: string, @CurrentUser() principal: Principal) {
    return this.consents.retire(id, principal);
  }
}
