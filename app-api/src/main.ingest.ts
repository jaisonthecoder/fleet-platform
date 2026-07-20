import './common/observability/instrumentation';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IngestModule } from './ingest.module';
import { SimulatorSourceService } from './modules/telematics/ingest/services/simulator-source.service';
import { TelemetryWriterService } from './modules/telematics/ingest/services/telemetry-writer.service';

/** Boots the standalone telemetry-ingest deployable (no HTTP server). */
async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(IngestModule, {
    bufferLogs: true,
  });
  context.enableShutdownHooks();

  const logger = new Logger('TelemetryIngest');
  const writer = context.get(TelemetryWriterService);
  const source = context.get(SimulatorSourceService);

  // The dumb, fast pipe: source → normalize (canonical) → batched Timescale write.
  source.start((points) => {
    void writer
      .write(points)
      .then((count) => logger.log(`Wrote ${count} telemetry point(s)`))
      .catch((error: unknown) =>
        logger.error(
          `Telemetry write failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        ),
      );
  });
}

void bootstrap();
