import { IncomingHttpHeaders } from 'node:http';

import type { HttpRequest } from '../../../src/types/request.ts';
import type { HttpHeaders } from '../../../src/types/headers.ts';
import type { WebServerHandle } from '../../../src/types/server.ts';

export type MakeRequestConfig<T> = {
  query?: Record<string, unknown>;
  body?: T;
  headers?: IncomingHttpHeaders | HttpHeaders;
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