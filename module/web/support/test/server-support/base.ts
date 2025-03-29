import type { HttpRequest } from '../../../src/types/request.ts';
import type { WebServerHandle } from '../../../src/types/server.ts';
import { HttpHeaders, HttpHeadersInit } from '../../../src/types/headers.ts';

export type MakeRequestConfig<T> = {
  query?: Record<string, unknown>;
  body?: T;
  headers?: HttpHeadersInit;
};

export type MakeRequestResponse<T> = {
  status: number;
  body: T;
  headers: HttpHeaders;
};

export interface WebServerSupport {
  init(qualifier?: symbol): Promise<WebServerHandle>;
  execute(method: HttpRequest['method'], path: string, cfg?: MakeRequestConfig<Buffer>): Promise<MakeRequestResponse<Buffer>>;
}