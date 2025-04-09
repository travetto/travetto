import { Readable } from 'node:stream';

import { Any, AppError, BinaryUtil, castTo } from '@travetto/runtime';

import { CookieGetOptions } from './cookie.ts';
import { WebHeadersInit, WebHeaders } from './headers.ts';
import { WebInternalSymbol, HttpMethod, HttpProtocol } from './core.ts';

export type WebRequestInit = {
  headers?: WebHeadersInit;
  method?: HttpMethod;
  protocol?: HttpProtocol;
  port?: number;
  query?: Record<string, unknown>;
  path?: string;
  params?: Record<string, unknown>;
  body?: unknown;
  remoteIp?: string;
  getCookie?: (key: string, opts: CookieGetOptions) => string | undefined;
};

export interface WebRequestInternal {
  requestParams?: unknown[];
  expandedQuery?: Record<string, unknown>;
  bodyHandled?: boolean;
}

/**
 * Web Request object
 */
export class WebRequest {

  [WebInternalSymbol]: WebRequestInternal = {};

  readonly headers: WebHeaders;
  readonly path: string = '';
  readonly port: number = 0;
  readonly protocol: HttpProtocol = 'http';
  readonly method: HttpMethod = 'GET';
  readonly query: Record<string, unknown> = {};
  readonly params: Record<string, string> = {};
  readonly remoteIp?: string;
  body?: Any;

  constructor(init: WebRequestInit = {}) {
    Object.assign(this, init);
    this.headers = new WebHeaders(init.headers);
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

  /**
   * Get body as input stream, if possible
   */
  getBodyAsStream(): Readable | undefined {
    const cfg = this.headers.getContentType();
    const encoding = cfg?.parameters.charset ?? 'utf8';
    let body = this.body;

    if (body === undefined) {
      return body;
    }

    if (typeof body === 'string') {
      body = Buffer.from(body, castTo(encoding));
    }

    if (Buffer.isBuffer(body)) {
      body = Readable.from(body);
    }

    if (BinaryUtil.isReadable(body)) {
      return body;
    }
  }
}
