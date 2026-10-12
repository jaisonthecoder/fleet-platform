import { ApiProperty } from '@nestjs/swagger';

import { STAFF_STATUSES } from './staff.dto';

/**
 * A seeded identity offered by the development sign-in picker.
 *
 * Never populated in a real environment: only identities issued by the local
 * header bypass appear here, and the endpoint reports itself disabled unless the
 * bypass is switched on.
 */
export class DevIdentityDto {
  @ApiProperty({ type: String })
  subject!: string;

  @ApiProperty({ type: String, format: 'email' })
  email!: string;

  @ApiProperty({ type: String })
  displayName!: string;

  @ApiProperty({ enum: STAFF_STATUSES })
  status!: (typeof STAFF_STATUSES)[number];

  @ApiProperty({ type: [String] })
  roleKeys!: string[];
}

export class DevIdentityListDto {
  @ApiProperty({ type: Boolean })
  enabled!: boolean;

  @ApiProperty({ type: [DevIdentityDto] })
  users!: DevIdentityDto[];
}
