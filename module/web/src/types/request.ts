import { Readable } from 'node:stream';

import { Any, AppError } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import { HttpResponse } from './response.ts';
import { CookieGetOptions } from './cookie.ts';
import { HttpHeadersInit, HttpHeaders } from './headers.ts';
import { HttpMethod, HttpProtocol } from './core.ts';

type RequestInit = {
  headers?: HttpHeadersInit;
  method?: HttpMethod;
  protocol?: HttpProtocol;
  port?: number;
  query?: Record<string, unknown>;
  path?: string;
  params?: Record<string, string>;
  respond?: (value: HttpResponse) => void;
  body?: unknown;
  inputStream?: Readable;
  remoteIp?: string;
  getCookie?: (key: string, opts: CookieGetOptions) => string | undefined;
};

export interface HttpRequestInternal {
  requestParams?: unknown[];
}

/**
 * Base Http Request object
 */
export class HttpRequest {

  #queryExpanded?: Record<string, unknown>;
  #internal: HttpRequestInternal = {};

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

  /**
   * Get the expanded query object
   */
  getExpandedQuery(this: HttpRequest): Record<string, unknown> {
    return this.#queryExpanded ??= BindUtil.expandPaths(this.query);
  }

  getInternal(): HttpRequestInternal {
    return this.#internal;
  }

  getCookie(key: string, opts?: CookieGetOptions): string | undefined {
    throw new AppError('Cannot access cookies without establishing read support', { category: 'general' });
  }

  respond(value: HttpResponse): void {
    // Do nothing by default
  }
}
