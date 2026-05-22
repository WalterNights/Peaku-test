import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { HEADER_CORRELATION_ID, HEADER_INTERNAL_API_KEY } from '@peaku/shared';
import type { AxiosRequestConfig } from 'axios';
import type { Request } from 'express';
import { of, throwError } from 'rxjs';

import { UpstreamService } from './upstream.service';

const buildMockReq = (overrides: Partial<Request['headers']> = {}): Request =>
  ({
    headers: {
      authorization: 'Bearer token-abc',
      [HEADER_CORRELATION_ID]: 'corr-123',
      ...overrides,
    },
  }) as unknown as Request;

const createHttpService = (
  responseStatus: number,
  responseData: unknown,
  capturedConfig?: { current?: AxiosRequestConfig },
): HttpService => {
  const request = jest.fn((config: AxiosRequestConfig) => {
    if (capturedConfig) {
      capturedConfig.current = config;
    }
    return of({ status: responseStatus, data: responseData, headers: {} });
  });
  return { request } as unknown as HttpService;
};

describe('UpstreamService', () => {
  it('propagates correlation-id, internal API key, and Authorization to the upstream', async () => {
    const captured: { current?: AxiosRequestConfig } = {};
    const http = createHttpService(200, { ok: true }, captured);
    const upstream = new UpstreamService(http, 'internal-secret-key');

    const res = await upstream.call({
      method: 'POST',
      baseUrl: 'http://auth-service:3001',
      path: '/api/v1/auth/login',
      body: { email: 'x@x.com', password: 'p' },
      originalReq: buildMockReq(),
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });

    const headers = captured.current?.headers as Record<string, string>;
    expect(headers[HEADER_CORRELATION_ID]).toBe('corr-123');
    expect(headers[HEADER_INTERNAL_API_KEY]).toBe('internal-secret-key');
    expect(headers['authorization']).toBe('Bearer token-abc');
  });

  it('forwards 4xx status from upstream without throwing', async () => {
    const http = createHttpService(401, { error: 'Unauthorized' });
    const upstream = new UpstreamService(http);

    const res = await upstream.call({
      method: 'GET',
      baseUrl: 'http://auth-service:3001',
      path: '/api/v1/auth/me',
      originalReq: buildMockReq(),
    });

    expect(res.status).toBe(401);
    expect(res.data).toEqual({ error: 'Unauthorized' });
  });

  it('throws ServiceUnavailableException on network error', async () => {
    const errorHttp = {
      request: jest.fn(() => throwError(() => new Error('ECONNREFUSED'))),
    } as unknown as HttpService;
    const upstream = new UpstreamService(errorHttp);

    await expect(
      upstream.call({
        method: 'GET',
        baseUrl: 'http://auth-service:3001',
        path: '/api/v1/auth/me',
        originalReq: buildMockReq(),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('handles missing correlation-id with "unknown" placeholder', async () => {
    const captured: { current?: AxiosRequestConfig } = {};
    const http = createHttpService(200, {}, captured);
    const upstream = new UpstreamService(http);

    await upstream.call({
      method: 'GET',
      baseUrl: 'http://auth-service:3001',
      path: '/health',
    });

    const headers = captured.current?.headers as Record<string, string>;
    expect(headers[HEADER_CORRELATION_ID]).toBe('unknown');
  });
});
