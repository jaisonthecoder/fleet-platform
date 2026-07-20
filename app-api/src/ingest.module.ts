import { Module } from '@nestjs/common';
import { CoreConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { LoggingModule } from './common/logging/logging.module';
import { TelematicsIngestModule } from './modules/telematics/ingest/telematics-ingest.module';

@Module({
  imports: [
    CoreConfigModule,
    LoggingModule,
    DatabaseModule,
    TelematicsIngestModule,
  ],
})
export class IngestModule {}
