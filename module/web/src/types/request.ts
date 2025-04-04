import { Readable } from 'node:stream';

import { Any, AppError } from '@travetto/runtime';

import { HttpResponse } from './response.ts';
import { CookieGetOptions } from './cookie.ts';
import { HttpHeadersInit, HttpHeaders } from './headers.ts';
import { HttpInternalSymbol, HttpMethod, HttpProtocol } from './core.ts';

type RequestInit = {
  headers?: HttpHeadersInit;
  method?: HttpMethod;
  protocol?: HttpProtocol;
  port?: number;
  query?: Record<string, unknown>;
  path?: string;
  params?: Record<string, unknown>;
  respond?: (value: HttpResponse) => void;
  body?: unknown;
  inputStream?: Readable;
  remoteIp?: string;
  getCookie?: (key: string, opts: CookieGetOptions) => string | undefined;
};

export interface HttpRequestInternal {
  requestParams?: unknown[];
  expandedQuery?: Record<string, unknown>;
}

/**
 * Base Http Request object
 */
export class HttpRequest {

  [HttpInternalSymbol]: HttpRequestInternal = {};

  readonly headers: HttpHeaders;
  readonly path: string = '';
  readonly port: number = 0;
  readonly protocol: HttpProtocol = 'http';
  readonly method: HttpMethod = 'GET';
  readonly query: Record<string, unknown> = {};
  readonly params: Record<string, string> = {};
  readonly remoteIp?: string;
  readonly inputStream?: Readable;
  body?: Any;

  constructor(init: RequestInit = {}) {
    Object.assign(this, init);
    this.headers = new HttpHeaders(init.headers);
  }

  /**
   * Attempt to read the remote IP address of the connection
   */
  getIp(): string | undefined {
    return this.headers.get('X-Forwarded-For') || this.remoteIp;
  }

  getCookie(key: string, opts?: CookieGetOptions): string | undefined {
    throw new AppError('Cannot access cookies without establishing read support', { category: 'general' });
  }

  respond(value: HttpResponse): void {
    // Do nothing by default
  }
}
