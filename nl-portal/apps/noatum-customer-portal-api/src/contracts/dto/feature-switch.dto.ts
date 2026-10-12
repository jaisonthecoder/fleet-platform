import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { FEATURE_SWITCH_CATEGORIES, FEATURE_SWITCH_KEYS } from '../feature-switches';

export const FeatureSwitchUpdateSchema = z
  .strictObject({
    enabled: z.boolean(),
    reason: z.string().trim().min(1).max(400),
    /** Required by the catalogue for switches carrying an external approval. */
    approvalReference: z.string().trim().max(200).nullable().default(null),
  })
  .refine(
    (value) => !value.enabled || value.approvalReference === null || value.approvalReference.length > 0,
    { message: 'Provide the approval reference or leave it empty.', path: ['approvalReference'] },
  );
export type FeatureSwitchUpdate = z.infer<typeof FeatureSwitchUpdateSchema>;

export class FeatureSwitchUpdateDto {
  @ApiProperty({ type: Boolean })
  enabled!: boolean;

  @ApiProperty({ type: String, minLength: 1, maxLength: 400 })
  reason!: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 200 })
  approvalReference!: string | null;
}

export class FeatureSwitchDto {
  @ApiProperty({ enum: FEATURE_SWITCH_KEYS })
  key!: string;

  @ApiProperty({ enum: FEATURE_SWITCH_CATEGORIES })
  category!: string;

  @ApiProperty({ type: String, description: 'English fallback; the client translates by key.' })
  label!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: Boolean })
  enabled!: boolean;

  @ApiProperty({ type: Boolean })
  defaultEnabled!: boolean;

  @ApiProperty({ type: Boolean, description: 'False while the switch sits at its code default.' })
  overridden!: boolean;

  @ApiProperty({ type: Boolean, description: 'Turning this on needs a recorded approval reference.' })
  requiresApproval!: boolean;

  @ApiProperty({ type: String, nullable: true })
  approvalReference!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt!: string | null;
}

export class ProtectedCapabilityDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  reason!: string;
}

export class FeatureSwitchListDto {
  @ApiProperty({ type: [FeatureSwitchDto] })
  switches!: FeatureSwitchDto[];

  @ApiProperty({ type: [ProtectedCapabilityDto], description: 'Invariants that are deliberately not switches.' })
  protected!: ProtectedCapabilityDto[];
}
