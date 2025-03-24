import { castTo } from '@travetto/runtime';

import { HttpPayload, HttpResponse, WebInternal } from '../types.ts';
import { Redirect } from './redirect.ts';
import { HttpPayloadUtil } from '../util/payload.ts';

type V = string | string[];

/**
 * Base response object
 */
export class HttpResponseCore implements Partial<HttpResponse> {

  /**
   * Add base response as support for the provided
   */
  static create<T extends HttpResponse>(
    res: Omit<Partial<T>, typeof WebInternal> & { [WebInternal]: Partial<HttpResponse[typeof WebInternal]> },
  ): T {
    Object.setPrototypeOf(res, HttpResponseCore.prototype);
    const final = castTo<T>(res);
    const core = castTo<HttpResponseCore>(res);
    core._payload = final[WebInternal].payload = HttpPayloadUtil.fromBytes(Buffer.alloc(0));
    core._headerNames = {};
    return final;
  }

  _headerNames: Record<string, string>;
  _payload: HttpPayload;

  get statusCode(): number | undefined {
    return this._payload.statusCode;
  }

  set statusCode(code: number) {
    this._payload.statusCode = code;
  }

  getHeaderNames(): string[] {
    return [...Object.keys(this._payload.headers ?? {})];
  }

  setHeader(key: string, value: (() => V) | V): void {
    const lk = key.toLowerCase();
    const fk = this._headerNames![lk] ??= key;
    this._payload.headers[fk] = typeof value === 'function' ? value() : value;
  }

  setHeaderIfMissing(key: string, value: (() => V) | V): void {
    if (!(key.toLowerCase() in this._headerNames)) {
      this.setHeader(key, value);
    }
  }

  getHeader(key: string): V | undefined {
    return this._payload.headers![this._headerNames![key.toLowerCase()]];
  }

  getHeaders(): Record<string, V> {
    return Object.freeze(this._payload.headers!);
  }

  removeHeader(key: string): void {
    const lk = key.toLowerCase();
    if (lk in this._headerNames!) {
      const fk = this._headerNames![lk];
      delete this._payload.headers![fk];
      delete this._headerNames![lk];
    }
  }

  /**
   * Set payload, with ability to merge or replace
   */
  setResponse(this: HttpResponse & HttpResponseCore, value: unknown, replace = false): HttpPayload {
    const payload = HttpPayloadUtil.from(value);

    if (payload.source === this._payload.source || this._payload.output === payload.output) {
      return this._payload;
    }

    const p = this._payload = this[WebInternal].payload = replace ?
      { ...payload } :
      { ...this._payload, ...payload, headers: { ...this._payload.headers, ...payload.headers } };

    this._headerNames = Object.fromEntries(Object.keys(p.headers).map(x => [x.toLowerCase(), x]));

    for (const [k, v] of Object.entries(this[WebInternal].headersAdded ?? {})) {
      this.setHeaderIfMissing(k, v);
    }

    // Set length if provided
    if (p.length) {
      this.setHeader('Content-Length', `${p.length} `);
    } else if (p.length === 0) {
      this.removeHeader('Content-Type');
    } else {
      this.removeHeader('Content-Length');
    }

    if (!this.getHeader('Content-Type') && p.length) {
      this.setHeader('Content-Type', p.defaultContentType ?? 'application/octet-stream');
    }

    if (!p.statusCode) {
      if (p.length === 0) {  // On empty response
        const method = (this[WebInternal].requestMethod ?? 'GET').toUpperCase();
        p.statusCode = method === 'POST' ? 201 : (method === 'PUT' ? 204 : 0);
      } else {
        p.statusCode = 200;
      }
    }

    return p;
  }

  /**
   * Add value to vary header, or create if not existing
   */
  vary(this: HttpResponse, value: string): void {
    const header = this.getHeader('vary');
    if (!header?.includes(value)) {
      this.setHeader('vary', header ? `${header}, ${value}` : value);
    }
  }

  /** NOTE:  Internally used to create a constant pattern for working with express-like systems, e.g. passport */

  /**
   * Trigger redirect
   * @private
   */
  redirect(this: HttpResponse & HttpResponseCore, path: string, statusCode?: number): void {
    this.respond(new Redirect(path, statusCode).serialize());
    this.end();
  }

  /**
   * End response immediately
   * @private
   */
  end(this: HttpResponse): void {
    this[WebInternal].takeControlOfResponse?.();
    this[WebInternal].nodeEntity.flushHeaders();
  }
}
