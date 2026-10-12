import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty({ type: String, format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String })
  displayName!: string;

  @ApiProperty({ type: String, format: 'email' })
  email!: string;

  @ApiProperty({ type: String, nullable: true })
  branchCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  branchName!: string | null;

  @ApiProperty({ type: [String] })
  roleKeys!: string[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  customerGroupId!: string | null;

  @ApiProperty({ type: Boolean })
  isInternal!: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  onBehalfOfUserId!: string | null;

  @ApiProperty({ type: [String] })
  accountIds!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];

  /**
   * Platform feature switches that are on. The SPA hides controls with these; the
   * FeatureGuard is what actually refuses the request.
   */
  @ApiProperty({ type: [String] })
  features!: string[];

  /**
   * The settings that apply to THIS user, already resolved through the hierarchy.
   * The SPA reads the same values the API enforces, so a screen cannot show a
   * four-hour countdown while the branch is actually running a day.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }] },
  })
  settings!: Record<string, boolean | number | string>;
}
