import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  approverActionSchema,
  availabilityQuerySchema,
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
  available(@Query() query: unknown) {
    return this.bookings.availability(parse(availabilityQuerySchema, query));
  }

  /** POST /api/v1/bookings — create a draft booking (reserves nothing yet). */
  @Post('bookings')
  create(@Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.bookings.create(parse(createBookingSchema, body), actorRef(principal));
  }

  /** GET /api/v1/bookings/:id — a booking projection. */
  @Get('bookings/:id')
  get(@Param('id') id: string) {
    return this.bookings.get(id);
  }

  /** GET /api/v1/bookings/:id/events — the append-only booking event log. */
  @Get('bookings/:id/events')
  events(@Param('id') id: string) {
    return this.bookings.events(id);
  }

  /** POST /api/v1/bookings/:id/consent — sign consent + issue number atomically (hard gate). */
  @Post('bookings/:id/consent')
  consent(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.bookings.signConsent(id, parse(signConsentSchema, body), actorRef(principal));
  }

  /** POST /api/v1/bookings/:id/submit — route the reserved booking to approval. */
  @Post('bookings/:id/submit')
  submit(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.bookings.submit(id, actorRef(principal));
  }

  /** POST /api/v1/bookings/:id/approve — approver approves the current step. */
  @Roles(...APPROVER_ROLES)
  @Post('bookings/:id/approve')
  approve(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    const action = parse(approverActionSchema, body);
    return this.bookings.decide(id, {
      ...action,
      actorPersonId: approvalActor(principal),
      decision: 'APPROVED',
    });
  }

  /** POST /api/v1/bookings/:id/decline — approver declines (releases the reservation). */
  @Roles(...APPROVER_ROLES)
  @Post('bookings/:id/decline')
  decline(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    const action = parse(approverActionSchema, body);
    return this.bookings.decide(id, {
      ...action,
      actorPersonId: approvalActor(principal),
      decision: 'REJECTED',
    });
  }

  /** POST /api/v1/bookings/:id/request-changes — approver requests modification (FR-BOOK-04). */
  @Roles(...APPROVER_ROLES)
  @Post('bookings/:id/request-changes')
  requestChanges(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    const action = parse(approverActionSchema, body);
    return this.bookings.decide(id, {
      ...action,
      actorPersonId: approvalActor(principal),
      decision: 'MODIFICATION_REQUESTED',
    });
  }

  /** PATCH /api/v1/bookings/:id — requester modifies vehicle/window (re-consent beyond tolerance). */
  @Patch('bookings/:id')
  modify(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.bookings.modify(id, parse(modifyBookingSchema, body), actorRef(principal));
  }

  /** POST /api/v1/bookings/:id/extend — mid-trip extension (downstream conflict → 409). */
  @Post('bookings/:id/extend')
  extend(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.bookings.extend(id, parse(extendBookingSchema, body), actorRef(principal));
  }

  /** POST /api/v1/bookings/:id/cancel — cancel and release the reservation. */
  @Post('bookings/:id/cancel')
  cancel(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.bookings.cancel(id, parse(cancelBookingSchema, body), actorRef(principal));
  }
}
