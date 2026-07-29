import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  approverActionSchema,
  availabilityQuerySchema,
  availabilityTimelineQuerySchema,
  cancelBookingSchema,
  createBookingSchema,
  extendBookingSchema,
  modifyBookingSchema,
  signConsentSchema,
} from '../../../contracts/booking.contract';
import { BookingService } from '../services/booking.service';

/** Actor reference for audit/history from the authenticated principal. */
const actorRef = (p?: Principal): string => p?.personId ?? p?.entraObjectId ?? 'system';

/** Returns the linked person acting on an approval or rejects an unlinked identity. */
const approvalActor = (principal: Principal): string => {
  if (!principal.personId) {
    throw new ForbiddenException({
      title: 'User not linked',
      reasons: ['user-not-linked-to-person'],
    });
  }
  return principal.personId;
};

/** Fails closed if an authenticated route is ever invoked without its Principal. */
const requiredPrincipal = (principal?: Principal): Principal => {
  if (!principal) {
    throw new ForbiddenException({
      title: 'Authenticated principal is required',
      reasons: ['authenticated-principal-required'],
    });
  }
  return principal;
};

/** Requires a bounded retry key before a mutating command reaches the service. */
const requiredIdempotencyKey = (value?: string): string => {
  const key = value?.trim();
  if (!key || key.length < 8 || key.length > 200) {
    throw new BadRequestException({
      title: 'A valid Idempotency-Key header is required',
      reasons: ['booking-idempotency-key-required'],
    });
  }
  return key;
};

/** Requires a material explanation for negative or change-request decisions. */
const requiredDecisionReason = (value?: string): string => {
  const reason = value?.trim();
  if (!reason) throw new BadRequestException({ title: 'A decision reason is required', reasons: ['booking-decision-reason-required'] });
  return reason;
};

/** Roles that may act on an approval step (SoD + workflow assignee is the real gate). */
const APPROVER_ROLES = [
  'Approver',
  'Delegate',
  'FleetManager',
  'ClusterFleetLead',
  'GroupFleetLead',
  'ClusterCEO',
] as const;

/** Parses a body with a Zod schema or throws an RFC-7807 400. */
function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException({
      title: 'Invalid request',
      reasons: result.error.issues.map((i) => i.message),
    });
  }
  return result.data;
}

@Controller({ version: '1' })
export class BookingsController {
  constructor(private readonly bookings: BookingService) {}

  /** GET /api/v1/vehicles/available — vehicles free for a window (same reservation range as commit). */
  @Get('vehicles/available')
  available(@Query() query: unknown, @CurrentUser() principal?: Principal) {
    return this.bookings.availability(parse(availabilityQuerySchema, query), requiredPrincipal(principal));
  }

  /** GET /api/v1/vehicles/availability-timeline — masked occupancy for screen 21. */
  @Get('vehicles/availability-timeline')
  availabilityTimeline(@Query() query: unknown, @CurrentUser() principal?: Principal) {
    return this.bookings.availabilityTimeline(
      parse(availabilityTimelineQuerySchema, query),
      requiredPrincipal(principal),
    );
  }

  /** POST /api/v1/bookings — create a draft booking (reserves nothing yet). */
  @Post('bookings')
  create(
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const actor = requiredPrincipal(principal);
    return this.bookings.create(
      parse(createBookingSchema, body),
      actorRef(actor),
      actor,
      requiredIdempotencyKey(idempotencyKey),
    );
  }

  /** GET /api/v1/bookings/context — actor modes, defaults and dependency readiness. */
  @Get('bookings/context')
  context(@CurrentUser() principal?: Principal) {
    return this.bookings.context(requiredPrincipal(principal));
  }

  /** GET /api/v1/bookings/people — bounded, organization/scope-authorized people. */
  @Get('bookings/people')
  people(@CurrentUser() principal?: Principal) {
    return this.bookings.bookablePeople(requiredPrincipal(principal));
  }

  /** GET /api/v1/booking-approvals — assigned/delegated safe approval evidence. */
  @Roles(...APPROVER_ROLES)
  @Get('booking-approvals')
  approvalWorklist(@CurrentUser() principal?: Principal) {
    return this.bookings.approvalWorklist(requiredPrincipal(principal));
  }

  /** GET /api/v1/booking-preparation — scoped Approved bookings awaiting handover. */
  @Get('booking-preparation')
  preparationWorklist(@CurrentUser() principal?: Principal) {
    return this.bookings.preparationWorklist(requiredPrincipal(principal));
  }

  /** GET /api/v1/bookings — authenticated person's own Booking collection. */
  @Get('bookings')
  myBookings(@CurrentUser() principal?: Principal) {
    return this.bookings.myBookings(requiredPrincipal(principal));
  }

  /** GET /api/v1/bookings/:id — a booking projection. */
  @Get('bookings/:id')
  get(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.bookings.get(id, requiredPrincipal(principal));
  }

  /** GET /api/v1/bookings/:id/events — the append-only booking event log. */
  @Get('bookings/:id/events')
  events(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.bookings.events(id, requiredPrincipal(principal));
  }

  /** POST /api/v1/bookings/:id/consent — sign consent + issue number atomically (hard gate). */
  @Post('bookings/:id/consent')
  consent(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() request?: FastifyRequest,
  ) {
    const actor = requiredPrincipal(principal);
    const { ip: _untrustedIp, ...parsed } = parse(signConsentSchema, body);
    return this.bookings.signConsent(
      id,
      { ...parsed, ...(request?.ip ? { ip: request.ip } : {}) },
      actorRef(actor),
      actor,
      requiredIdempotencyKey(idempotencyKey),
    );
  }

  /** POST /api/v1/bookings/:id/submit — route the reserved booking to approval. */
  @Post('bookings/:id/submit')
  submit(
    @Param('id') id: string,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const actor = requiredPrincipal(principal);
    return this.bookings.submit(
      id,
      actorRef(actor),
      actor,
      requiredIdempotencyKey(idempotencyKey),
    );
  }

  /** POST /api/v1/bookings/:id/approve — approver approves the current step. */
  @Roles(...APPROVER_ROLES)
  @Post('bookings/:id/approve')
  approve(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    const action = parse(approverActionSchema, body);
    return this.bookings.decide(id, {
      ...action,
      actorPersonId: approvalActor(principal),
      decision: 'APPROVED',
    }, principal, requiredIdempotencyKey(idempotencyKey));
  }

  /** POST /api/v1/bookings/:id/decline — approver declines (releases the reservation). */
  @Roles(...APPROVER_ROLES)
  @Post('bookings/:id/decline')
  decline(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    const action = parse(approverActionSchema, body);
    return this.bookings.decide(id, {
      ...action,
      reason: requiredDecisionReason(action.reason),
      actorPersonId: approvalActor(principal),
      decision: 'REJECTED',
    }, principal, requiredIdempotencyKey(idempotencyKey));
  }

  /** POST /api/v1/bookings/:id/request-changes — approver requests modification (FR-BOOK-04). */
  @Roles(...APPROVER_ROLES)
  @Post('bookings/:id/request-changes')
  requestChanges(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    const action = parse(approverActionSchema, body);
    return this.bookings.decide(id, {
      ...action,
      reason: requiredDecisionReason(action.reason),
      actorPersonId: approvalActor(principal),
      decision: 'MODIFICATION_REQUESTED',
    }, principal, requiredIdempotencyKey(idempotencyKey));
  }

  /** PATCH /api/v1/bookings/:id — requester modifies vehicle/window (re-consent beyond tolerance). */
  @Patch('bookings/:id')
  modify(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const actor = requiredPrincipal(principal);
    return this.bookings.modify(
      id,
      parse(modifyBookingSchema, body),
      actorRef(actor),
      actor,
      requiredIdempotencyKey(idempotencyKey),
    );
  }

  /** POST /api/v1/bookings/:id/extend — mid-trip extension (downstream conflict → 409). */
  @Post('bookings/:id/extend')
  extend(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const actor = requiredPrincipal(principal);
    return this.bookings.extend(
      id,
      parse(extendBookingSchema, body),
      actorRef(actor),
      actor,
      requiredIdempotencyKey(idempotencyKey),
    );
  }

  /** POST /api/v1/bookings/:id/cancel — cancel and release the reservation. */
  @Post('bookings/:id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const actor = requiredPrincipal(principal);
    return this.bookings.cancel(
      id,
      parse(cancelBookingSchema, body),
      actorRef(actor),
      actor,
      requiredIdempotencyKey(idempotencyKey),
    );
  }
}
