import { AppError, castTo } from '@travetto/runtime';

import { CookieGetOptions } from './cookie.ts';
import { WebHeaders } from './headers.ts';
import { WebInternalSymbol, HttpMethod, HttpProtocol } from './core.ts';
import { WebMessage, WebMessageInit } from './message.ts';

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

  /**
   * Secure the request
   */
  static secure(req: WebRequest, trustProxy: string[]): typeof req {
    const forwardedFor = req.headers.get('X-Forwarded-For');

    if (forwardedFor) {
      if (trustProxy[0] === '*' || (req.connection.ip && Array.isArray(trustProxy) && trustProxy.includes(req.connection.ip))) {
        req.connection.protocol = castTo(req.headers.get('X-Forwarded-Proto')!) || req.connection.protocol;
        req.connection.host = req.headers.get('X-Forwarded-Host') || req.connection.host;
        req.connection.ip = forwardedFor;
      }
    }
    req.headers.delete('X-Forwarded-For');
    req.headers.delete('X-Forwarded-Proto');
    req.headers.delete('X-Forwarded-Host');
    return req;
  }

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
  }

  getCookie(key: string, opts?: CookieGetOptions): string | undefined {
    throw new AppError('Cannot access cookies without establishing read support', { category: 'general' });
  }
}