import { BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse,
  ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  ImportRunDto,
  ImportRunListDto,
  ImportRunRequestDto,
  ImportRunRequestSchema,
  OrganisationDetailDto,
  OrganisationListDto,
  OrganisationQuerySchema,
} from '../../contracts/dto/organisation.dto';
import { PERMISSIONS } from '../../contracts/permissions';
import { OrganisationsService } from './organisations.service';

@ApiTags('organisations')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@Controller('admin/organisations')
export class OrganisationsController {
  constructor(private readonly organisations: OrganisationsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ADMIN_ORGANISATIONS_LINK)
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: 'countryCode', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'active', 'inactive'] })
  @ApiQuery({ name: 'provenance', required: false, enum: ['all', 'confirmed', 'provisional'] })
  @ApiQuery({ name: 'linked', required: false, enum: ['all', 'linked', 'unlinked'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: OrganisationListDto })
  list(@Query() query: unknown): Promise<OrganisationListDto> {
    const parsed = OrganisationQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid filter.');
    return this.organisations.list(parsed.data);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ADMIN_ORGANISATIONS_LINK)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: OrganisationDetailDto })
  @ApiNotFoundResponse()
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<OrganisationDetailDto> {
    return this.organisations.detail(id);
  }

  @Get('imports/runs')
  @RequirePermission(PERMISSIONS.ADMIN_ORGANISATIONS_IMPORT)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ImportRunListDto })
  runs(): Promise<ImportRunListDto> {
    return this.organisations.runs();
  }

  @Post('imports/runs')
  @RequirePermission(PERMISSIONS.ADMIN_ORGANISATIONS_IMPORT)
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: ImportRunRequestDto })
  @ApiOkResponse({ type: ImportRunDto })
  @ApiBadRequestResponse()
  runImport(@Body() body: unknown): Promise<ImportRunDto> {
    const parsed = ImportRunRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid request.');
    return this.organisations.import(parsed.data);
  }
}
