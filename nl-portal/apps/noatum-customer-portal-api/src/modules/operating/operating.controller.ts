import { BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  BranchCreateDto,
  BranchCreateSchema,
  BranchDto,
  BranchListDto,
  BranchQuerySchema,
  BranchUpdateDto,
  BranchUpdateSchema,
  CargoWiseBranchListDto,
  CargoWiseBranchQuerySchema,
  RegionCreateDto,
  RegionCreateSchema,
  RegionDto,
  RegionListDto,
  RegionQuerySchema,
  RegionUpdateDto,
  RegionUpdateSchema,
} from '../../contracts/dto/operating.dto';
import { PERMISSIONS } from '../../contracts/permissions';
import { OperatingService } from './operating.service';

function parse<T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error?.issues[0]?.message ?? 'Invalid request.');
  return result.data as T;
}

@ApiTags('operating')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@Controller('admin/operating')
export class OperatingController {
  constructor(private readonly operating: OperatingService) {}

  // --- regions ---

  @Get('regions')
  @RequirePermission(PERMISSIONS.ADMIN_OPERATING_READ)
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'active', 'inactive'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: RegionListDto })
  listRegions(@Query() query: unknown): Promise<RegionListDto> {
    return this.operating.listRegions(parse(RegionQuerySchema, query));
  }

  @Post('regions')
  @RequirePermission(PERMISSIONS.ADMIN_OPERATING_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: RegionCreateDto })
  @ApiCreatedResponse({ type: RegionDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'The region code already exists.' })
  createRegion(@Body() body: unknown): Promise<RegionDto> {
    return this.operating.createRegion(parse(RegionCreateSchema, body));
  }

  @Patch('regions/:id')
  @RequirePermission(PERMISSIONS.ADMIN_OPERATING_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: RegionUpdateDto })
  @ApiOkResponse({ type: RegionDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiNotFoundResponse()
  updateRegion(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<RegionDto> {
    return this.operating.updateRegion(id, parse(RegionUpdateSchema, body));
  }

  // --- branches ---

  @Get('branches')
  @RequirePermission(PERMISSIONS.ADMIN_OPERATING_READ)
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: 'regionId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'active', 'inactive'] })
  @ApiQuery({ name: 'mapped', required: false, enum: ['all', 'mapped', 'unmapped'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: BranchListDto })
  listBranches(@Query() query: unknown): Promise<BranchListDto> {
    return this.operating.listBranches(parse(BranchQuerySchema, query));
  }

  @Get('branches/:id')
  @RequirePermission(PERMISSIONS.ADMIN_OPERATING_READ)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: BranchDto })
  @ApiNotFoundResponse()
  branchDetail(@Param('id', ParseUUIDPipe) id: string): Promise<BranchDto> {
    return this.operating.branchDetail(id);
  }

  @Post('branches')
  @RequirePermission(PERMISSIONS.ADMIN_OPERATING_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: BranchCreateDto })
  @ApiCreatedResponse({ type: BranchDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'The branch code already exists, or the region is not available.' })
  createBranch(@Body() body: unknown): Promise<BranchDto> {
    return this.operating.createBranch(parse(BranchCreateSchema, body));
  }

  @Patch('branches/:id')
  @RequirePermission(PERMISSIONS.ADMIN_OPERATING_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: BranchUpdateDto })
  @ApiOkResponse({ type: BranchDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'Stale record, region unavailable, or the branch is still in use.' })
  @ApiNotFoundResponse()
  updateBranch(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<BranchDto> {
    return this.operating.updateBranch(id, parse(BranchUpdateSchema, body));
  }

  // --- CargoWise ControllingBranch discovery ---

  @Get('cargowise-branches')
  @RequirePermission(PERMISSIONS.ADMIN_OPERATING_READ)
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'mapped', required: false, enum: ['all', 'mapped', 'unmapped'] })
  @ApiOkResponse({ type: CargoWiseBranchListDto })
  listCargoWiseBranches(@Query() query: unknown): Promise<CargoWiseBranchListDto> {
    return this.operating.listCargoWiseBranches(parse(CargoWiseBranchQuerySchema, query));
  }
}
