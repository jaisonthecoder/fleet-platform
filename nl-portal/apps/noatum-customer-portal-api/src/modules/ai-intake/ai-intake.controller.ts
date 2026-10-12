import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { PERMISSIONS } from '../../contracts';

import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

import { AiIntakeService } from './ai-intake.service';

/** 8 MB of base64 is roughly a 6 MB file, which is plenty for an invoice. */
const MAX_BASE64 = 8 * 1024 * 1024;

const intakeSchema = z
  .object({
    text: z.string().trim().min(1).max(20_000).optional(),
    file: z
      .object({
        mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
        dataBase64: z.string().min(1).max(MAX_BASE64),
      })
      .optional(),
    locale: z.string().max(10).optional(),
  })
  .refine((body) => Boolean(body.text || body.file), {
    message: 'Send either text or a file.',
  });

class IntakeFileDto {
  @ApiProperty() mimeType!: string;
  @ApiProperty() dataBase64!: string;
}

class IntakeRequestDto {
  @ApiPropertyOptional({ description: 'Pasted enquiry text.' })
  text?: string;

  @ApiPropertyOptional({ type: IntakeFileDto })
  file?: IntakeFileDto;

  @ApiPropertyOptional() locale?: string;
}

class IntakeQuestionDto {
  @ApiProperty() id!: string;
  @ApiProperty() field!: string;
  @ApiProperty() ask!: string;
}

class IntakeDerivedDto {
  @ApiProperty() rule!: string;
  @ApiProperty() text!: string;
}

class IntakeDraftDto {
  @ApiProperty({ enum: ['extracted', 'not-configured', 'unreadable'] })
  status!: string;

  @ApiPropertyOptional() detail?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  provenance!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  fields!: Record<string, unknown>;

  @ApiProperty({ type: [IntakeDerivedDto] })
  derived!: IntakeDerivedDto[];

  @ApiProperty({ type: [IntakeQuestionDto] })
  questions!: IntakeQuestionDto[];
}

class IntakeAvailabilityDto {
  @ApiProperty() configured!: boolean;
}

/**
 * Demo-scope assistant. Reads a document or a pasted enquiry and returns a DRAFT
 * for the request form. It persists nothing and submits nothing.
 */
@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiIntakeController {
  constructor(private readonly intake: AiIntakeService) {}

  @RequirePermission(PERMISSIONS.QUOTES_CREATE)
  @RequireFeature('quotations.ai_intake')
  @Get('quote-intake/availability')
  @ApiOkResponse({ type: IntakeAvailabilityDto })
  availability(): IntakeAvailabilityDto {
    return { configured: this.intake.isConfigured() };
  }

  @RequirePermission(PERMISSIONS.QUOTES_CREATE)
  @RequireFeature('quotations.ai_intake')
  @Post('quote-intake')
  @ApiBody({ type: IntakeRequestDto })
  @ApiOkResponse({ type: IntakeDraftDto })
  async quoteIntake(@Body() body: unknown): Promise<IntakeDraftDto> {
    const input = intakeSchema.parse(body);

    const draft = await this.intake.draft(
      { text: input.text, file: input.file },
      input.locale,
    );

    return draft as unknown as IntakeDraftDto;
  }
}
