import { ApiProperty } from '@nestjs/swagger';

import { SETTING_GROUPS, SETTING_KEYS, SETTING_SCOPES } from '../settings';

export class SettingOptionDto {
  @ApiProperty({ type: String })
  value!: string;

  @ApiProperty({ type: String })
  label!: string;
}

export class ResolvedSettingDto {
  @ApiProperty({ enum: SETTING_KEYS })
  key!: string;

  @ApiProperty({
    oneOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }],
    description: 'The value that applies, after the hierarchy has been walked.',
  })
  value!: boolean | number | string;

  @ApiProperty({
    enum: [...SETTING_SCOPES, 'default'],
    description: 'Which layer supplied the value. The screen prints this.',
  })
  source!: string;

  @ApiProperty({ type: String, nullable: true })
  sourceId!: string | null;
}

export class SettingOverrideDto {
  @ApiProperty({ enum: SETTING_SCOPES })
  scope!: string;

  @ApiProperty({ type: String, nullable: true })
  scopeId!: string | null;

  @ApiProperty({ oneOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }] })
  value!: unknown;

  @ApiProperty({
    type: Boolean,
    description: 'False when the stored value no longer fits the catalogue, so the resolver skips it.',
  })
  valid!: boolean;

  @ApiProperty({ type: String })
  reason!: string;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class SettingDto {
  @ApiProperty({ enum: SETTING_KEYS })
  key!: string;

  @ApiProperty({ enum: SETTING_GROUPS })
  group!: string;

  @ApiProperty({ enum: ['boolean', 'number', 'enum'] })
  type!: string;

  @ApiProperty({ type: String, description: 'English fallback; the client translates by key.' })
  label!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String, nullable: true, description: 'hours, days, EUR.' })
  unit!: string | null;

  @ApiProperty({ type: [SettingOptionDto], nullable: true })
  options!: SettingOptionDto[] | null;

  @ApiProperty({ type: Number, nullable: true })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  max!: number | null;

  @ApiProperty({ oneOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }] })
  defaultValue!: boolean | number | string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Platform switch that must be on for this setting to be read at all.',
  })
  requiresSwitch!: string | null;

  @ApiProperty({ type: ResolvedSettingDto })
  effective!: ResolvedSettingDto;

  @ApiProperty({ type: [SettingOverrideDto] })
  overrides!: SettingOverrideDto[];
}

export class SetSettingDto {
  @ApiProperty({ enum: SETTING_SCOPES })
  scope!: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 64 })
  scopeId!: string | null;

  @ApiProperty({ oneOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }] })
  value!: boolean | number | string;

  @ApiProperty({ type: String, minLength: 3, maxLength: 400 })
  reason!: string;
}

export class SettingChangeDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  actorUserId!: string | null;

  @ApiProperty({ type: String })
  action!: string;

  @ApiProperty({ type: String, nullable: true, description: 'The setting key.' })
  entityId!: string | null;

  @ApiProperty({ type: Object })
  metadata!: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
