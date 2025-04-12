import { AppError, castTo } from '@travetto/runtime';

import { CookieGetOptions } from './cookie.ts';
import { WebHeaders } from './headers.ts';
import { WebInternalSymbol, HttpMethod, HttpProtocol } from './core.ts';
import { WebMessage, WebMessageInit } from './message.ts';

import { WebBodyUtil } from '../util/body.ts';

export interface WebConnection {
  host?: string;
  port?: number;
  protocol?: HttpProtocol;
  ip?: string;
}

export interface WebRequestInit<B = unknown> extends WebMessageInit<B> {
  method?: HttpMethod;
  connection?: WebConnection;
  query?: Record<string, unknown>;
  path?: string;
  params?: Record<string, unknown>;
  getCookie?: (key: string, opts: CookieGetOptions) => string | undefined;
};

export interface WebRequestInternal {
  requestParams?: unknown[];
  expandedQuery?: Record<string, unknown>;
}

/**
 * Web Request object
 */
export class WebRequest<B = unknown> implements WebMessage<B> {

  [WebInternalSymbol]: WebRequestInternal = {};

  readonly headers: WebHeaders;
  readonly connection: WebConnection = {};
  readonly path: string = '';
  readonly method: HttpMethod = 'GET';
  readonly query: Record<string, unknown> = {};
  readonly params: Record<string, string> = {};
  body?: B;

  constructor(init: WebRequestInit<B> = {}) {
    Object.assign(this, init);
    this.headers = new WebHeaders(init.headers);

    if (!this.headers.getContentType() && this.body) {
      this.headers.set('Content-Type', WebBodyUtil.defaultContentType(this.body));
    }
  }

  getCookie(key: string, opts?: CookieGetOptions): string | undefined {
    throw new AppError('Cannot access cookies without establishing read support', { category: 'general' });
  }

  /**
   * Secure the request
   */
  secure(trustProxy: string[]): this {
    const forwardedFor = this.headers.get('X-Forwarded-For');

    if (forwardedFor) {
      if (trustProxy[0] === '*' || (this.connection.ip && Array.isArray(trustProxy) && trustProxy.includes(this.connection.ip))) {
        this.connection.protocol = castTo(this.headers.get('X-Forwarded-Proto')) || this.connection.protocol;
        this.connection.host = this.headers.get('X-Forwarded-Host') || this.connection.host;
        this.connection.ip = forwardedFor;
      }
    }
    this.headers.delete('X-Forwarded-For');
    this.headers.delete('X-Forwarded-Proto');
    this.headers.delete('X-Forwarded-Host');
    return this;
  }
}