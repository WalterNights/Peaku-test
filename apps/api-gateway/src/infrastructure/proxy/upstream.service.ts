import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HEADER_CORRELATION_ID, HEADER_INTERNAL_API_KEY } from '@peaku/shared';
import type { AxiosError, AxiosRequestConfig, Method } from 'axios';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';

export interface UpstreamCallOptions {
  method: Method;
  baseUrl: string;
  path: string;
  /** Original request — usado para extraer correlation-id y headers relevantes */
  originalReq?: Request;
  query?: Record<string, unknown>;
  body?: unknown;
}

export interface UpstreamResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Encapsula la comunicación HTTP entre el gateway y los servicios internos.
 *
 * Responsabilidades:
 * - Propaga `x-correlation-id` end-to-end.
 * - Inyecta `x-internal-api-key` (defensa en profundidad: aunque alguien
 *   alcance la red interna, los servicios pueden requerir el secret).
 * - Pasa el Authorization header al downstream sin tocarlo (el servicio
 *   downstream lo re-verifica — defense in depth).
 * - Mapea errores de red → ServiceUnavailableException (504/503 al cliente).
 * - Transparente con códigos 4xx/5xx del upstream: los reenvía al cliente.
 */
@Injectable()
export class UpstreamService {
  private readonly logger = new Logger(UpstreamService.name);
  private readonly internalApiKey: string | undefined;

  constructor(
    private readonly http: HttpService,
    internalKey?: string,
  ) {
    this.internalApiKey = internalKey;
  }

  async call<T = unknown>(opts: UpstreamCallOptions): Promise<UpstreamResponse<T>> {
    const correlationId = this.extractCorrelationId(opts.originalReq);
    const headers: Record<string, string> = {
      [HEADER_CORRELATION_ID]: correlationId,
      'content-type': 'application/json',
    };

    if (this.internalApiKey) {
      headers[HEADER_INTERNAL_API_KEY] = this.internalApiKey;
    }

    // Propagamos el Authorization sin tocarlo. Defense in depth:
    // el downstream re-verifica con el mismo secret.
    const auth = opts.originalReq?.headers.authorization;
    if (typeof auth === 'string' && auth.length > 0) {
      headers.authorization = auth;
    }

    const config: AxiosRequestConfig = {
      method: opts.method,
      url: `${opts.baseUrl}${opts.path}`,
      headers,
      // axios NO debe tirar excepción ante 4xx/5xx — los reenvía al caller.
      // Solo errores de red/timeout dispararán catch.
      validateStatus: () => true,
    };

    if (opts.query) {
      config.params = opts.query;
    }
    if (opts.body !== undefined) {
      config.data = opts.body;
    }

    try {
      const response = await firstValueFrom(this.http.request<T>(config));
      return {
        status: response.status,
        data: response.data,
        headers: this.pickResponseHeaders(response.headers),
      };
    } catch (err) {
      this.logger.error(
        { err, correlationId, target: `${opts.baseUrl}${opts.path}` },
        `Upstream unreachable: ${(err as AxiosError).message}`,
      );
      throw new ServiceUnavailableException('Upstream service unreachable');
    }
  }

  private extractCorrelationId(req?: Request): string {
    if (!req) {
      return 'unknown';
    }
    const id = req.headers[HEADER_CORRELATION_ID];
    return typeof id === 'string' && id.length > 0 ? id : 'unknown';
  }

  private pickResponseHeaders(raw: Record<string, unknown> | undefined): Record<string, string> {
    if (!raw) {
      return {};
    }
    const allow = ['content-type', HEADER_CORRELATION_ID];
    const out: Record<string, string> = {};
    for (const key of allow) {
      const value = raw[key];
      if (typeof value === 'string') {
        out[key] = value;
      }
    }
    return out;
  }
}
