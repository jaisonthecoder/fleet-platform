import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  createLookupTypeSchema,
  createLookupValueSchema,
  importLookupSchema,
  listLookupValuesQuerySchema,
  reorderSchema,
  updateLookupTypeSchema,
  updateLookupValueSchema,
} from '../../../contracts/lookup.contract';
import { LookupService } from '../services/lookup.service';

/** Resolves an audit actor reference from the authenticated admin. */
const actorRef = (principal?: Principal): string =>
  principal?.personId ?? principal?.entraObjectId ?? 'admin';

/**
 * Reference-data administration (RBAC-gated). Data stewards / system admins
 * manage lookup types and values — every change is audited and invalidates the
 * cache. Admin reads are paged/enriched (status, usage counts, parent labels).
 */
@Roles('DataSteward', 'SystemAdmin')
@Controller({ path: 'admin/lookups', version: '1' })
export class LookupAdminController {
  constructor(private readonly lookups: LookupService) {}

  /** The type catalogue with active/total value counts. */
  @Get('types')
  listTypes() {
    return this.lookups.listTypesForAdmin();
  }

  /** Creates a new (non-system) lookup type. */
  @Post('types')
  createType(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const parsed = createLookupTypeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid lookup type',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.lookups.createType(parsed.data, actorRef(principal));
  }

  /** Updates a non-system lookup type (labels/descriptions/hierarchy flag). */
  @Patch('types/:id')
  updateType(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = updateLookupTypeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid lookup type update',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.lookups.updateType(id, parsed.data, actorRef(principal));
  }

  /** Paged/enriched values for a type (includes inactive), filtered by search/status/parent. */
  @Get(':typeCode/values')
  listValues(@Param('typeCode') typeCode: string, @Query() query: unknown) {
    const parsed = listLookupValuesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid lookup values query',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.lookups.listValuesForAdmin(typeCode, parsed.data);
  }

  /** Enriched children of a parent value within a type (includes inactive). */
  @Get(':typeCode/:parentCode/children')
  listChildren(
    @Param('typeCode') typeCode: string,
    @Param('parentCode') parentCode: string,
  ) {
    return this.lookups.listChildrenForAdmin(typeCode, parentCode);
  }

  /**
   * Every child of a value ACROSS types (Model values under a Make value, plus
   * self-nested same-type children) \u2014 each tagged with its own type. Drives the
   * cross-type tree in the reference-data admin.
   */
  @Get('values/:valueId/children')
  listValueChildren(@Param('valueId') valueId: string) {
    return this.lookups.listChildrenByValueId(valueId);
  }

  /** Candidate parent values for this type's parent selector (cross-type aware). */
  @Get(':typeCode/parent-options')
  parentOptions(@Param('typeCode') typeCode: string) {
    return this.lookups.parentOptions(typeCode);
  }

  /** Exports every value of a type (JSON array; round-trips through import). */
  @Get(':typeCode/export')
  export(@Param('typeCode') typeCode: string) {
    return this.lookups.exportType(typeCode);
  }

  /** Bulk upserts a type's values (keyed by code); returns a summary. */
  @Post(':typeCode/import')
  import(
    @Param('typeCode') typeCode: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = importLookupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid import payload',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.lookups.importValues(typeCode, parsed.data, actorRef(principal));
  }

  /** Adds a value to a type (optionally under a parent code for cascading). */
  @Post(':typeCode/values')
  create(
    @Param('typeCode') typeCode: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = createLookupValueSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid lookup value',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.lookups.createValue(typeCode, parsed.data, actorRef(principal));
  }

  /** Updates a value's labels/order/active/retiring flag (code is immutable). */
  @Patch('values/:id')
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = updateLookupValueSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid lookup update',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.lookups.updateValue(id, parsed.data, actorRef(principal));
  }

  /** Moves a value one position up/down among its siblings. */
  @Post('values/:id/reorder')
  reorder(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid reorder request',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.lookups.reorderValue(id, parsed.data.direction, actorRef(principal));
  }

  /** Deactivates a value (soft-state). */
  @Post('values/:id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() principal: Principal) {
    return this.lookups.deactivateValue(id, actorRef(principal));
  }

  /** Reactivates a deactivated value. */
  @Post('values/:id/activate')
  activate(@Param('id') id: string, @CurrentUser() principal: Principal) {
    return this.lookups.activateValue(id, actorRef(principal));
  }
}
