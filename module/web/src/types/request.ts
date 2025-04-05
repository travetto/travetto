import { Readable } from 'node:stream';

import { Any, AppError } from '@travetto/runtime';

import { CookieGetOptions } from './cookie.ts';
import { WebHeadersInit, WebpHeaders } from './headers.ts';
import { WebInternalSymbol, HttpMethod, HttpProtocol } from './core.ts';

type RequestInit = {
  headers?: WebHeadersInit;
  method?: HttpMethod;
  protocol?: HttpProtocol;
  port?: number;
  query?: Record<string, unknown>;
  path?: string;
  params?: Record<string, unknown>;
  body?: unknown;
  inputStream?: Readable;
  remoteIp?: string;
  getCookie?: (key: string, opts: CookieGetOptions) => string | undefined;
};

export interface WebRequestInternal {
  requestParams?: unknown[];
  expandedQuery?: Record<string, unknown>;
}

/**
 * Web Request object
 */
export class WebRequest {

  [WebInternalSymbol]: WebRequestInternal = {};

  readonly headers: WebpHeaders;
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
    this.headers = new WebpHeaders(init.headers);
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
}
