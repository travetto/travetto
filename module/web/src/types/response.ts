import { Readable } from 'node:stream';
import { BinaryUtil, castTo, Util } from '@travetto/runtime';

import { Cookie } from './cookie.ts';
import { WebHeadersInit, WebHeaders } from './headers.ts';
import { NodeBinary, WebBodyUtil } from '../util/body.ts';

export type WebResponseInput<B> = {
  body: B;
  statusCode?: number;
  headers?: WebHeadersInit;
  cookies?: Cookie[];
};

/**
 * Web Response as a simple object
 */
export class WebResponse<B = unknown> {

  /**
    * Build the redirect
    * @param location Location to redirect to
    * @param status Status code
    */
  static redirect(location: string, status = 302): WebResponse<undefined> {
    return new WebResponse({
      body: undefined, statusCode: status, headers: { Location: location }
    });
  }

  /**
   * From catch value
   */
  static fromCatch(err: unknown): WebResponse<Error> {
    return err instanceof WebResponse ? err : new WebResponse({ body: Util.ensureError(err) });
  }

  /**
   * Create a web response from a body input
   */
  static for<T>(body: T, opts?: Omit<WebResponseInput<T>, 'body'>): WebResponse<T> {
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
  toBinary(): WebResponse<NodeBinary> {
    const body = this.body;
    if (Buffer.isBuffer(body) || BinaryUtil.isReadable(body)) {
      return castTo(this);
    }

    const out = new WebResponse<NodeBinary>({
      headers: new WebHeaders(this.headers), body: null!,
      cookies: this.getCookies(), statusCode: this.statusCode
    });

    if (body instanceof Blob) {
      const meta = BinaryUtil.getBlobMeta(body);
      out.statusCode = meta?.range ? 206 : out.statusCode;
      for (const [k, v] of WebBodyUtil.getBlobHeaders(body)) {
        out.headers.set(k, v);
      }
      out.body = Readable.fromWeb(body.stream());
    } else if (body instanceof FormData) {
      const boundary = `${'-'.repeat(24)}'-multipart-${Util.uuid()}`;
      out.headers.set('Content-Type', `multipart/form-data; boundary=${boundary}`);
      out.body = Readable.from(WebBodyUtil.buildMultiPartBody(body, boundary));
    } else if (BinaryUtil.isReadableStream(body)) {
      out.body = Readable.fromWeb(body);
    } else if (BinaryUtil.isAsyncIterable(body)) {
      out.body = Readable.from(body);
    } else {
      out.body = WebBodyUtil.buildBufferPayload(body);
    }
    return out;
  }
}