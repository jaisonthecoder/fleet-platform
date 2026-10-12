import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { PortDto, PortSearchSchema, type PortSearch } from '../../contracts';

import { AuthenticatedOnly } from '../../common/decorators/authenticated-only.decorator';

import { PortsService } from './ports.service';

/** Same shape as the other controllers': the first issue is the message. */
function parse<T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error?.issues[0]?.message ?? 'Invalid request.');
  return result.data as T;
}

/**
 * Route autocomplete.
 *
 * `@AuthenticatedOnly` for the same reason as the reference lists: these are the
 * valid values of the origin and destination fields, so anyone who may see those
 * fields may search them. RLS decides which rows come back.
 */
@ApiTags('reference')
@ApiBearerAuth()
@Controller('ports')
export class PortsController {
  constructor(private readonly ports: PortsService) {}

  @AuthenticatedOnly()
  @Get('search')
  // Optional in the document as well as in the schema: a generated client that
  // believes these are required forces every caller to invent a value.
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Prefix of the port name, its UN/LOCODE or its country. Omit for the first page in name order.',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiQuery({ name: 'mode', required: false, enum: ['sea', 'air'] })
  @ApiQuery({ name: 'country', required: false, description: 'ISO 3166-1 alpha-2.' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: [PortDto] })
  search(
    @Query('q') q?: string,
    @Query('locale') locale?: string,
    @Query('mode') mode?: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ): Promise<PortDto[]> {
    // Undefined rather than empty string, so an omitted parameter stays optional
    // instead of failing a length rule it was never meant to meet.
    const input = parse<PortSearch>(PortSearchSchema, {
      ...(q ? { q } : {}),
      ...(locale ? { locale } : {}),
      ...(mode ? { mode } : {}),
      ...(country ? { country } : {}),
      ...(limit ? { limit } : {}),
    });
    return this.ports.search(input);
  }
}
