import { Readable } from 'node:stream';

import { Any, AppError, BinaryUtil } from '@travetto/runtime';

import { CookieGetOptions } from './cookie.ts';
import { WebHeaders } from './headers.ts';
import { WebInternalSymbol, HttpMethod, HttpProtocol } from './core.ts';
import { NodeBinary, WebBodyUtil } from '../util/body.ts';
import { WebMessage, WebMessageInit } from './message.ts';

export interface WebRequestInit<B> extends WebMessageInit<B> {
  method?: HttpMethod;
  protocol?: HttpProtocol;
  port?: number;
  query?: Record<string, unknown>;
  path?: string;
  params?: Record<string, unknown>;
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
export class WebRequest<B = unknown> implements WebMessage<B> {

  static markUnprocessed<T extends NodeBinary | undefined>(val: T): T {
    if (val) {
      Object.defineProperty(val, WebInternalSymbol, { value: val });
    }
    return val;
  }

  [WebInternalSymbol]: WebRequestInternal = {};

  readonly headers: WebHeaders;
  readonly path: string = '';
  readonly port: number = 0;
  readonly protocol: HttpProtocol = 'http';
  readonly method: HttpMethod = 'GET';
  readonly query: Record<string, unknown> = {};
  readonly params: Record<string, string> = {};
  readonly remoteIp?: string;
  body?: B;

  constructor(init: WebRequestInit<B> = {}) {
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
   * Get unprocessed body as readable stream
   */
  getUnprocessedStream(): Readable | undefined {
    const p = this.body;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    if ((Buffer.isBuffer(p) || BinaryUtil.isReadable(p)) && (p as Any)[WebInternalSymbol] === p) {
      return WebBodyUtil.toReadable(p);
    }
  }
}