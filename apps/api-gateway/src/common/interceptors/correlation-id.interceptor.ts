import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { HEADER_CORRELATION_ID } from '@peaku/shared';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const incoming = req.headers[HEADER_CORRELATION_ID];
    const correlationId = typeof incoming === 'string' && incoming.length > 0 ? incoming : uuid();

    req.headers[HEADER_CORRELATION_ID] = correlationId;
    res.setHeader(HEADER_CORRELATION_ID, correlationId);

    return next.handle();
  }
}
