import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * One message we have exchanged, or intend to exchange, with an external system.
 *
 * Staff-facing. A customer is never shown any of this: whether a message is
 * queued is our problem, and telling them would invite them to wait for it.
 */
export class IntegrationMessageStatusDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ enum: ['inbound', 'outbound'] })
  direction!: string;

  @ApiProperty({
    enum: ['pending', 'sending', 'sent', 'acknowledged', 'failed', 'skipped'],
    description:
      'pending is the normal resting state while no transport is configured: built and held, not lost. skipped means a switch told us not to send it.',
  })
  status!: string;

  @ApiProperty({ type: String, example: 'quote.request.create' })
  operation!: string;

  @ApiProperty({ type: Number })
  attempts!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastError!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  sentAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  externalReference!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class IntegrationSyncStatusDto {
  @ApiProperty({ type: String, example: 'Q-000042' })
  portalRef!: string;

  @ApiProperty({
    type: Boolean,
    description: 'False while the CargoWise transport is held, which is the case today.',
  })
  transportConfigured!: boolean;

  @ApiProperty({ type: [IntegrationMessageStatusDto] })
  messages!: IntegrationMessageStatusDto[];
}

export function integrationMessageStatusFor(row: {
  id: string;
  direction: string;
  status: string;
  operation: string;
  attempts: number;
  lastError: string | null;
  sentAt: Date | null;
  externalReference: string | null;
  createdAt: Date;
}): IntegrationMessageStatusDto {
  return {
    id: row.id,
    direction: row.direction,
    status: row.status,
    operation: row.operation,
    attempts: row.attempts,
    lastError: row.lastError,
    sentAt: row.sentAt?.toISOString() ?? null,
    externalReference: row.externalReference,
    createdAt: row.createdAt.toISOString(),
  };
}
