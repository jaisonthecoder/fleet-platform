import { BadRequestException, Body, Controller, Get, Header, Param, Patch } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../contracts/permissions';
import {
  FeatureSwitchDto,
  FeatureSwitchListDto,
  FeatureSwitchUpdateDto,
  FeatureSwitchUpdateSchema,
} from '../../contracts/dto/feature-switch.dto';
import { FeaturesService } from './features.service';

/**
 * These routes are never themselves @RequireFeature gated. A switch able to
 * disable the page that controls the switches would be a lock with the key
 * inside.
 */
@ApiTags('features')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@Controller('admin/feature-switches')
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ADMIN_FLAGS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: FeatureSwitchListDto })
  list(): Promise<FeatureSwitchListDto> {
    return this.features.list();
  }

  @Patch(':key')
  @RequirePermission(PERMISSIONS.ADMIN_FLAGS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'key', type: String })
  @ApiBody({ type: FeatureSwitchUpdateDto })
  @ApiOkResponse({ type: FeatureSwitchDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  update(@Param('key') key: string, @Body() body: unknown): Promise<FeatureSwitchDto> {
    const parsed = FeatureSwitchUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid change.');
    return this.features.update(key, parsed.data);
  }
}
