import type { WebRequest } from '../../../src/types/request.ts';
import type { WebServerHandle } from '../../../src/types/server.ts';
import { WebpHeaders, WebHeadersInit } from '../../../src/types/headers.ts';

export type MakeRequestConfig<T> = {
  query?: Record<string, unknown>;
  body?: T;
  headers?: WebHeadersInit;
};

export type MakeRequestResponse<T> = {
  status: number;
  body: T;
  headers: WebpHeaders;
};

export interface WebServerSupport {
  init(qualifier?: symbol): Promise<WebServerHandle>;
  execute(method: WebRequest['method'], path: string, cfg?: MakeRequestConfig<Buffer>): Promise<MakeRequestResponse<Buffer>>;
}