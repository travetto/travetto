import { Readable } from 'node:stream';

import { Any, AppError, BinaryUtil, castTo } from '@travetto/runtime';

import { CookieGetOptions } from './cookie.ts';
import { WebHeaders } from './headers.ts';
import { WebInternalSymbol, HttpMethod, HttpProtocol } from './core.ts';
import { NodeBinary, WebBodyUtil } from '../util/body.ts';
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

  static markUnprocessed<T extends NodeBinary | undefined>(val: T): T {
    if (val) {
      Object.defineProperty(val, WebInternalSymbol, { value: val });
    }
    return val;
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

  /**
   * Get unprocessed body as readable stream
   */
  getUnprocessedStream(): Readable | undefined {
    const p = this.body;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    if ((Buffer.isBuffer(p) || BinaryUtil.isReadable(p)) && (p as Any)[WebInternalSymbol] === p) {
      return WebBodyUtil.toReadable(p);
    }
  }

  /**
   * Secure the request
   */
  secure(trustProxy: boolean | string[]): this {
    const forwardedFor = this.headers.get('X-Forwarded-For');

    if (forwardedFor) {
      if (this.connection.ip && (trustProxy === true || (Array.isArray(trustProxy) && trustProxy?.includes(this.connection.ip)))) {
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