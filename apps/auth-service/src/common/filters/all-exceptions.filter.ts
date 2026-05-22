import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HEADER_CORRELATION_ID, type ApiErrorResponse, type ErrorDetail } from '@peaku/shared';
import type { Request, Response } from 'express';

import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserNotFoundError,
} from '../../domain/errors';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.resolveStatus(exception);
    const { message, error, details } = this.resolveBody(exception);
    const correlationId = (request.headers[HEADER_CORRELATION_ID] as string | undefined) ?? 'unknown';

    const body: ApiErrorResponse = {
      statusCode: status,
      message,
      error,
      ...(details ? { details } : {}),
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= 500) {
      this.logger.error(
        { err: exception, correlationId, path: request.url },
        `Unhandled error: ${message}`,
      );
    } else if (status >= 400) {
      this.logger.warn({ correlationId, path: request.url, status }, message);
    }

    response.status(status).json(body);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof EmailAlreadyRegisteredError) {
      return HttpStatus.CONFLICT;
    }
    if (exception instanceof InvalidCredentialsError || exception instanceof InvalidRefreshTokenError) {
      return HttpStatus.UNAUTHORIZED;
    }
    if (exception instanceof UserNotFoundError) {
      return HttpStatus.NOT_FOUND;
    }
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveBody(exception: unknown): { message: string; error: string; details?: ErrorDetail[] } {
    if (
      exception instanceof EmailAlreadyRegisteredError ||
      exception instanceof InvalidCredentialsError ||
      exception instanceof InvalidRefreshTokenError ||
      exception instanceof UserNotFoundError
    ) {
      return { message: exception.message, error: exception.name };
    }

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { message: res, error: exception.name };
      }
      const obj = res as { message?: string | string[]; error?: string };
      const message = Array.isArray(obj.message) ? obj.message.join('; ') : (obj.message ?? exception.message);
      const details: ErrorDetail[] | undefined = Array.isArray(obj.message)
        ? obj.message.map((m) => ({ field: 'unknown', issue: m }))
        : undefined;
      return { message, error: obj.error ?? exception.name, details };
    }

    return {
      message: 'Internal server error',
      error: 'InternalServerError',
    };
  }
}
