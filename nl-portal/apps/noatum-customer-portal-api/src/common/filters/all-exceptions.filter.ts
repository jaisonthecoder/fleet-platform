import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * One response shape for every failure, and nothing leaked from an unexpected one.
 *
 * Client errors keep their message. Anything unrecognised becomes a 500 with a
 * correlation id the caller can quote - the detail goes to the log, not the response.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string; method: string; correlationId?: string }>();
    const correlationId = request.correlationId ?? 'unknown';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      response.status(status).json({
        statusCode: status,
        error: typeof body === 'string' ? body : (body as Record<string, unknown>).message,
        details: typeof body === 'object' ? (body as Record<string, unknown>).details : undefined,
        correlationId,
        path: request.url,
      });
      return;
    }

    this.logger.error(
      { err: exception, correlationId, path: request.url, method: request.method },
      'Unhandled exception',
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal server error',
      correlationId,
      path: request.url,
    });
  }
}
