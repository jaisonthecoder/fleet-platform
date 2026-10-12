import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { ReferenceItemDto } from '../../contracts';

import { AuthenticatedOnly } from '../../common/decorators/authenticated-only.decorator';

import { ReferenceService } from './reference.service';

/**
 * Option lists, for filling a dropdown.
 *
 * `@AuthenticatedOnly` rather than a permission: these are the valid values of a
 * field, and anyone who may see the field may see them. Which items come back
 * still depends on who is asking - a customer gets only the customer-visible
 * ones, enforced in the service.
 */
@ApiTags('reference')
@ApiBearerAuth()
@Controller('reference')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @AuthenticatedOnly()
  @Get(':category')
  // Both are optional, and the document must say so: a generated client that
  // believes they are required forces every caller to invent a value.
  @ApiQuery({ name: 'locale', required: false })
  @ApiQuery({ name: 'mode', required: false })
  @ApiOkResponse({ type: [ReferenceItemDto] })
  items(
    @Param('category') category: string,
    @Query('locale') locale?: string,
    @Query('mode') mode?: string,
  ) {
    return this.reference.items(category, { locale, mode });
  }
}
