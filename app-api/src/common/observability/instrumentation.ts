/**
 * OpenTelemetry bootstrap.
 *
 * This module is imported FIRST in every entrypoint (before Nest and the
 * framework libraries) so auto-instrumentation can patch modules as they load.
 * It is a no-op unless `OTEL_ENABLED=true` and an Application Insights
 * connection string are present, so local development and tests are unaffected.
 */
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { monitorEventLoopDelay } from 'node:perf_hooks';

let sdk: NodeSDK | undefined;
let eventLoopTimer: NodeJS.Timeout | undefined;

/** Returns true when a truthy env flag string is set. */
function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}

/**
 * Samples event-loop delay and logs p99 (ms) periodically. A rising `api` p99
 * signals CPU work leaking into the request path (the "sacred booking path").
 */
function startEventLoopLagMonitor(): void {
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  eventLoopTimer = setInterval(() => {
    const p99Ms = histogram.percentile(99) / 1e6;
    histogram.reset();
    // eslint-disable-next-line no-console
    console.debug(
      JSON.stringify({ metric: 'event_loop_lag_p99_ms', value: p99Ms }),
    );
  }, 10_000);
  eventLoopTimer.unref();
}

/** Initialises the OpenTelemetry SDK when enabled; never throws. */
export function initTelemetry(): void {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!isEnabled(process.env.OTEL_ENABLED) || !connectionString) {
    return;
  }
  try {
    sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'fleet-api',
      traceExporter: new AzureMonitorTraceExporter({ connectionString }),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
    startEventLoopLagMonitor();
    process.once('SIGTERM', () => {
      if (eventLoopTimer) {
        clearInterval(eventLoopTimer);
      }
      void sdk?.shutdown();
    });
  } catch (error) {
    // Telemetry must never crash the process.
    // eslint-disable-next-line no-console
    console.error('OpenTelemetry initialisation failed', error);
  }
}

initTelemetry();
