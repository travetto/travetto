import { castTo } from '@travetto/runtime';

import { HttpResponse, WebInternal } from '../types.ts';
import { Redirect } from './redirect.ts';
import { HttpPayload } from './payload.ts';

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
    core._payload = HttpPayload.fromEmpty();
    final[WebInternal].requestMethod = (final[WebInternal].requestMethod ?? 'GET').toUpperCase();
    return final;
  }

  _payload: HttpPayload;
  get statusCode(): number | undefined { return this._payload.statusCode; }
  set statusCode(code: number) { this._payload.statusCode = code; }
  getHeaderNames(): string[] { return this._payload.getHeaderNames(); }
  setHeader(key: string, value: string | string[]): void { this._payload.setHeader(key, value); }
  getHeader(key: string): string | string[] | undefined { return this._payload.getHeader(key); }
  getHeaders(): Record<string, string | string[]> { return this._payload.getHeaders(); }
  removeHeader(key: string): void { this._payload.removeHeader(key); }

  /**
   * Set payload, with ability to merge or replace
   */
  getPayload(this: HttpResponse & HttpResponseCore, value: unknown): HttpPayload {
    if (value instanceof HttpPayload && value === this._payload) {
      return value;
    }

    const method = (this[WebInternal].requestMethod ?? 'GET').toUpperCase();
    return this._payload = HttpPayload.from(value)
      .setHeadersIfMissing(this[WebInternal].headersAdded ?? {})
      .ensureContentLength()
      .ensureContentType()
      .ensureStatusCode(method === 'POST' ? 201 : (method === 'PUT' ? 204 : 200));
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
