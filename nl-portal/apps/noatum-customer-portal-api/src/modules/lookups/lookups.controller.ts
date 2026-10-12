import { BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../contracts/permissions';
import {
  LookupCategoryCreateDto,
  LookupCategoryCreateSchema,
  LookupCategoryDto,
  LookupCategoryUpdateDto,
  LookupCategoryUpdateSchema,
  LookupItemCreateDto,
  LookupItemCreateSchema,
  LookupItemDto,
  LookupItemListDto,
  LookupItemQuerySchema,
  LookupItemUpdateDto,
  LookupItemUpdateSchema,
} from '../../contracts/dto/lookup.dto';
import { LookupsService } from './lookups.service';

@ApiTags('lookups')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@Controller('admin/lookups')
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  @Get('categories')
  @RequirePermission(PERMISSIONS.ADMIN_LOOKUPS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LookupCategoryDto, isArray: true })
  categories(): Promise<LookupCategoryDto[]> {
    return this.lookups.categories();
  }

  @Post('categories')
  @RequirePermission(PERMISSIONS.ADMIN_LOOKUPS_MANAGE)
  @RequireFeature('lookups.type_creation')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: LookupCategoryCreateDto })
  @ApiCreatedResponse({ type: LookupCategoryDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  createCategory(@Body() body: unknown): Promise<LookupCategoryDto> {
    const parsed = LookupCategoryCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid list.');
    return this.lookups.createCategory(parsed.data);
  }

  @Patch('categories/:code')
  @RequirePermission(PERMISSIONS.ADMIN_LOOKUPS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'code', type: String })
  @ApiBody({ type: LookupCategoryUpdateDto })
  @ApiOkResponse({ type: LookupCategoryDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  updateCategory(@Param('code') code: string, @Body() body: unknown): Promise<LookupCategoryDto> {
    const parsed = LookupCategoryUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid list.');
    return this.lookups.updateCategory(code, parsed.data);
  }

  @Get('categories/:code/items')
  @RequirePermission(PERMISSIONS.ADMIN_LOOKUPS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'code', type: String })
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'active', 'inactive'] })
  @ApiQuery({ name: 'visibility', required: false, enum: ['all', 'customer', 'internal'] })
  @ApiQuery({ name: 'parentCode', required: false, type: String, maxLength: 80 })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, maximum: 10000 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiOkResponse({ type: LookupItemListDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  items(@Param('code') code: string, @Query() query: unknown): Promise<LookupItemListDto> {
    const parsed = LookupItemQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Invalid lookup item query.');
    return this.lookups.items(code, parsed.data);
  }

  @Get('categories/:code/parent-options')
  @RequirePermission(PERMISSIONS.ADMIN_LOOKUPS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'code', type: String })
  @ApiOkResponse({ type: LookupItemDto, isArray: true })
  @ApiNotFoundResponse()
  parentOptions(@Param('code') code: string): Promise<LookupItemDto[]> {
    return this.lookups.parentOptions(code);
  }

  @Post('categories/:code/items')
  @RequirePermission(PERMISSIONS.ADMIN_LOOKUPS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'code', type: String })
  @ApiBody({ type: LookupItemCreateDto })
  @ApiCreatedResponse({ type: LookupItemDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  createItem(@Param('code') code: string, @Body() body: unknown): Promise<LookupItemDto> {
    const parsed = LookupItemCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid value.');
    return this.lookups.createItem(code, parsed.data);
  }

  @Patch('items/:id')
  @RequirePermission(PERMISSIONS.ADMIN_LOOKUPS_MANAGE)
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: LookupItemUpdateDto })
  @ApiOkResponse({ type: LookupItemDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<LookupItemDto> {
    const parsed = LookupItemUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid value.');
    return this.lookups.updateItem(id, parsed.data);
  }
}
