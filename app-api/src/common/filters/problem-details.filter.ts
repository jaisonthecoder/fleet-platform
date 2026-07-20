import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** RFC-7807 problem-details response body. */
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  reasons?: string[];
  instance?: string;
}

/**
 * Maps every thrown error to an RFC-7807 `application/problem+json` response so
 * "blocks explain themselves": denials carry machine reason codes the client
 * localises (EN + AR). PDP-denied and validation errors flow through here.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  /** Serialises any exception into a problem-details payload. */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const problem = this.toProblem(exception, status, request.url);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    void reply
      .status(status)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }

  /** Builds the problem body, extracting title/detail/reasons from the error. */
  private toProblem(
    exception: unknown,
    status: number,
    instance: string,
  ): ProblemDetails {
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: HttpStatus[status] ?? 'Error',
      status,
      instance,
    };

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        problem.detail = response;
      } else if (response && typeof response === 'object') {
        const body = response as Record<string, unknown>;
        if (typeof body.title === 'string') {
          problem.title = body.title;
        }
        if (Array.isArray(body.reasons)) {
          problem.reasons = body.reasons.map(String);
        }
        const message = body.message;
        if (typeof message === 'string') {
          problem.detail = message;
        } else if (Array.isArray(message)) {
          problem.reasons = [...(problem.reasons ?? []), ...message.map(String)];
        }
      }
    }

    return problem;
  }
}
