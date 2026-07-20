import { Module } from '@nestjs/common';
import { SimulatorSourceService } from './services/simulator-source.service';
import { TelemetryWriterService } from './services/telemetry-writer.service';

@Module({
  providers: [SimulatorSourceService, TelemetryWriterService],
  exports: [SimulatorSourceService, TelemetryWriterService],
})
export class TelematicsIngestModule {}
