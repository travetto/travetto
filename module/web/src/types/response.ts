import { Readable } from 'node:stream';

import { Any, BinaryUtil, castTo, Util } from '@travetto/runtime';

import { Cookie } from './cookie.ts';
import { WebHeadersInit, WebHeaders } from './headers.ts';
import { WebBodyUtil } from '../util/body.ts';

export type WebResponseInput<B> = {
  body: B;
  statusCode?: number;
  headers?: WebHeadersInit;
  cookies?: Cookie[];
};

type BinaryBody = Readable | Buffer;

/**
 * Web Response as a simple object
 */
export class WebResponse<B = unknown> {

  /**
    * Build the redirect
    * @param location Location to redirect to
    * @param status Status code
    */
  static redirect(location: string, status = 302): WebResponse<null> {
    return new WebResponse({ body: null, statusCode: status, headers: { Location: location } });
  }

  /**
   * From catch value
   */
  static fromCatch(err: unknown): WebResponse<Error> {
    return err instanceof WebResponse ? err :
      new WebResponse({ body: Util.ensureError(err) });
  }

  /**
   * Create a web response from a body input
   */
  static from<T>(body: T, opts?: Omit<WebResponseInput<T>, 'body'>): WebResponse<T> {
    return new WebResponse<T>({ ...opts, body });
  }

  #cookies: Record<string, Cookie> = {};
  statusCode?: number;
  body: B;
  readonly headers: WebHeaders;

  constructor(o: WebResponseInput<B>) {
    this.statusCode ??= o.statusCode;
    this.#cookies = Object.fromEntries(o.cookies?.map(x => [x.name, x]) ?? []);
    this.body = castTo(o.body);
    this.headers = new WebHeaders(o.headers);

    if (this.body instanceof Error) {
      this.statusCode ??= WebBodyUtil.getErrorStatus(this.body);
    } else if (Buffer.isBuffer(this.body)) {
      this.headers.set('Content-Length', `${this.body.byteLength}`);
    }

    if (!this.headers.has('Content-Type')) {
      this.headers.set('Content-Type', WebBodyUtil.defaultContentType(o.body));
    }
  }

  /**
   * Store a cookie by name, will be handled by the CookieJar at send time
   */
  setCookie(cookie: Cookie): void {
    this.#cookies[cookie.name] = { ...cookie, maxAge: (cookie.value !== undefined) ? cookie.maxAge : -1 };
  }

  /**
   * Get all the registered cookies
   */
  getCookies(): Cookie[] {
    return Object.values(this.#cookies);
  }

  /**
   * Set all values into the map
   */
  backfillHeaders(value: WebHeadersInit): this {
    const entries = Array.isArray(value) ? value : value instanceof Headers ? value.entries() : Object.entries(value);
    for (const [k, v] of entries) {
      if (!this.headers.has(k) && v !== null && v !== undefined) {
        this.headers.set(k, castTo(v));
      }
    }
    return this;
  }

  /**
   * Get a binary version
   */
  toBinary(): WebResponse<BinaryBody> {
    const out: Omit<WebResponseInput<Any>, 'headers'> & { headers: WebHeaders } = {
      headers: this.headers, body: this.body,
      cookies: this.getCookies(), statusCode: this.statusCode
    };

    if (this.body instanceof FormData) {
      const [boundary, body] = WebBodyUtil.buildMultiPartBody(this.body);
      out.headers = new WebHeaders([...out.headers.entries(), ['Content-Type', `multipart/form-data; boundary=${boundary}`]]);
      out.body = body;
    } else {
      out.body = BinaryUtil.toNodeBinaryValue(this.body);
      if (out.body === this.body) { // unchanged
        return castTo(this);
      } else if (this.body instanceof Blob) {
        const meta = BinaryUtil.getBlobMeta(this.body);
        out.statusCode = meta?.range ? 206 : out.statusCode;
        out.headers = new WebHeaders([...out.headers.entries(), ...WebBodyUtil.getBlobHeaders(this.body)]);
      }
    }
    return new WebResponse(out);
  }
}