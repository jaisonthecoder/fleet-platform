import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * The pricing assistant's wire shapes.
 *
 * They live beside the assistant rather than in `contracts/dto` so the whole
 * capability is one folder plus one controller block. Move them the day this
 * stops being demo scope.
 */

/** 8 MB of base64 is roughly a 6 MB file, which is plenty for a rate sheet. */
const MAX_BASE64 = 8 * 1024 * 1024;

export const assistSchema = z
  .object({
    /**
     * `brief` and `scaffold` run no model at all. `reply` reads what a carrier
     * sent. `message` drafts the covering note.
     */
    want: z.enum(['brief', 'scaffold', 'reply', 'message']),
    /** How many option shapes to scaffold. Ignored by the other intents. */
    count: z.number().int().min(1).max(3).optional(),
    /**
     * `current` rewrites the option the pricer is looking at; `new` adds one.
     * Defaults to `current`, because "fill this in for me" is the common ask and
     * silently growing the list is the behaviour nobody wants.
     */
    target: z.enum(['current', 'new']).default('current'),
    /** Demo only: put indicative figures in, rather than leaving rates blank. */
    fill: z.boolean().optional(),
    /** How many the assistant has already built, so the next one is a new shape. */
    existing: z.number().int().min(0).max(3).optional(),
    text: z.string().trim().min(1).max(20_000).optional(),
    file: z
      .object({
        mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
        dataBase64: z.string().min(1).max(MAX_BASE64),
      })
      .optional(),
    locale: z.string().max(10).optional(),
    /** A summary of what the pricer has typed, so a covering note can mention it. */
    draft: z
      .array(
        z.object({
          name: z.string().max(120).optional(),
          carrierName: z.string().max(160).optional(),
          transitDaysMin: z.number().int().min(0).max(400).nullable().optional(),
          transitDaysMax: z.number().int().min(0).max(400).nullable().optional(),
          freeTimeDays: z.number().int().min(0).max(400).nullable().optional(),
          validUntil: z.string().max(40).optional(),
          currency: z.string().max(10).optional(),
          /** Decimal major units, for wording only. Nothing is recomputed from it. */
          total: z.number().nonnegative().optional(),
        }),
      )
      .max(10)
      .optional(),
  })
  .refine((body) => body.want !== 'reply' || Boolean(body.text || body.file), {
    message: 'Send the carrier reply as text or as a file.',
  });

export type AssistInput = z.infer<typeof assistSchema>;

class AssistFileDto {
  /* Typed as a plain string on the wire because the browser hands us whatever
     `File.type` says. The zod schema still refuses anything but the four types. */
  @ApiProperty({ description: 'application/pdf, image/png, image/jpeg or image/webp.' })
  mimeType!: string;

  @ApiProperty() dataBase64!: string;
}

class AssistDraftOptionDto {
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional() carrierName?: string;
  @ApiPropertyOptional({ type: Number, nullable: true }) transitDaysMin?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) transitDaysMax?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) freeTimeDays?: number | null;
  @ApiPropertyOptional() validUntil?: string;
  @ApiPropertyOptional() currency?: string;
  @ApiPropertyOptional({ description: 'Decimal major units, for wording only.' })
  total?: number;
}

/** The request body, described so the generated client knows its shape. */
export class PricingAssistRequestDto {
  @ApiProperty({ enum: ['brief', 'scaffold', 'reply', 'message'] })
  want!: string;

  @ApiPropertyOptional({ type: Number }) count?: number;

  @ApiPropertyOptional({ enum: ['current', 'new'] }) target?: string;

  @ApiPropertyOptional({ type: Number }) existing?: number;

  @ApiPropertyOptional({ type: Boolean, description: 'Demo only: indicative figures.' })
  fill?: boolean;

  @ApiPropertyOptional() text?: string;

  @ApiPropertyOptional({ type: AssistFileDto }) file?: AssistFileDto;

  @ApiPropertyOptional() locale?: string;

  @ApiPropertyOptional({ type: [AssistDraftOptionDto] })
  draft?: AssistDraftOptionDto[];
}

class AssistLineDto {
  @ApiProperty() code!: string;
  @ApiProperty() description!: string;
  @ApiProperty() basis!: string;
  @ApiProperty() quantity!: string;
  @ApiProperty({ description: 'Decimal major units as the carrier wrote it. Blank when scaffolded.' })
  rate!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ description: 'Why this line is here. Shown beside it, never stored.' })
  reason!: string;
  @ApiProperty({ type: Boolean, description: 'True where the rate is a demonstration figure.' })
  indicative!: boolean;
}

class AssistOptionDto {
  @ApiProperty() name!: string;
  @ApiProperty() carrierName!: string;
  @ApiProperty() serviceRouting!: string;
  @ApiProperty() transitDaysMin!: string;
  @ApiProperty() transitDaysMax!: string;
  @ApiProperty() nextDepartures!: string;
  @ApiProperty() freeTimeDays!: string;
  @ApiProperty() validUntil!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() notes!: string;
  @ApiProperty({ type: [AssistLineDto] }) lines!: AssistLineDto[];
}

class AssistQuestionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Which option the answer belongs to. -1 for the quote.' })
  optionIndex!: number;
  @ApiProperty() field!: string;
  @ApiProperty() ask!: string;
}

class AssistDerivedDto {
  @ApiProperty() rule!: string;
  @ApiProperty() text!: string;
}

export class PricingAssistDto {
  @ApiProperty({ enum: ['ready', 'not-configured', 'unreadable'] })
  status!: string;

  @ApiPropertyOptional() detail?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  provenance!: Record<string, unknown>;

  @ApiProperty({ type: [String], description: 'What the assistant says, in order.' })
  say!: string[];

  @ApiProperty({ type: [AssistDerivedDto], description: 'Why it proposed what it did.' })
  derived!: AssistDerivedDto[];

  @ApiProperty({ type: [AssistOptionDto], description: 'Proposed options. Empty for a brief.' })
  options!: AssistOptionDto[];

  @ApiProperty({ type: [AssistQuestionDto] })
  questions!: AssistQuestionDto[];

  @ApiProperty({
    enum: ['current', 'new'],
    description: 'Whether the SPA should rewrite the open option or add one.',
  })
  target!: string;

  @ApiProperty({
    type: Boolean,
    description: 'True where the rates are demonstration figures a pricer must replace.',
  })
  indicative!: boolean;

  @ApiPropertyOptional({ description: 'A covering note draft. Present only for want=message.' })
  message?: string;
}
