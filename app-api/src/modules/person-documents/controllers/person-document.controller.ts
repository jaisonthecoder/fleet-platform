import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import { addPersonDocumentSchema } from '../../../contracts/person-document.contract';
import { PersonDocumentService } from '../services/person-document.service';

/** Requires a linked person or rejects an unlinked identity. */
function actorOf(principal: Principal): string {
  if (!principal?.personId) {
    throw new ForbiddenException({
      title: 'User not linked',
      reasons: ['user-not-linked-to-person'],
    });
  }
  return principal.personId;
}

/** Validates an add-document body or throws a 400 with stable reasons. */
function parseAdd(body: unknown) {
  const parsed = addPersonDocumentSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      title: 'Invalid document',
      reasons: parsed.error.issues.map((i) => i.message),
    });
  }
  return parsed.data;
}

@Controller({ version: '1' })
export class PersonDocumentController {
  constructor(private readonly service: PersonDocumentService) {}

  /** The caller's own document set. */
  @Get('me/documents')
  myDocuments(@CurrentUser() principal: Principal) {
    return this.service.list(actorOf(principal));
  }

  /** Self-service upload (metadata; stored as Unverified). */
  @Post('me/documents')
  addMyDocument(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const actor = actorOf(principal);
    return this.service.add(actor, parseAdd(body), actor, false);
  }

  /** Admin/steward: list any person's documents. */
  @Roles('SystemAdmin', 'DataSteward')
  @Get('admin/persons/:personId/documents')
  personDocuments(@Param('personId') personId: string) {
    return this.service.list(personId);
  }

  /** Admin/steward: add a document for any person (Verified). */
  @Roles('SystemAdmin', 'DataSteward')
  @Post('admin/persons/:personId/documents')
  addPersonDocument(
    @Param('personId') personId: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    return this.service.add(personId, parseAdd(body), actorOf(principal), true);
  }

  /** Admin/steward: confirm (verify) a document. */
  @Roles('SystemAdmin', 'DataSteward')
  @Post('admin/persons/documents/:documentId/confirm')
  confirm(
    @Param('documentId') documentId: string,
    @CurrentUser() principal: Principal,
  ) {
    return this.service.confirm(documentId, actorOf(principal));
  }
}
