import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import { Any, AppError, BinaryUtil, castTo, ErrorCategory, hasFunction, hasToJSON, Util } from '@travetto/runtime';

import { Cookie } from './cookie.ts';
import { WebHeadersInit, WebHeaders } from './headers.ts';
import { WebInternalSymbol } from './core.ts';
import { WebBodyUtil } from '../util/body.ts';
import { isArrayBuffer } from 'node:util/types';

const isReadableStream = hasFunction<ReadableStream>('pipeTo');
const isAsyncIterable = (v: unknown): v is AsyncIterable<unknown> =>
  !!v && (typeof v === 'object' || typeof v === 'function') && Symbol.asyncIterator in v;

type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

const DEFAULT_TYPE = 'application/octet-stream';

/**
 * Mapping from error category to standard http error codes
 */
const CATEGORY_STATUS: Record<ErrorCategory, number> = {
  general: 500,
  notfound: 404,
  data: 400,
  permissions: 403,
  authentication: 401,
  timeout: 408,
  unavailable: 503,
};

export type WebResponseInput<B = unknown> = {
  body: B;
  statusCode?: number;
  headers?: WebHeadersInit;
  cookies?: Cookie[];
};

type BinaryBody = Readable | Buffer;

export type WebResponseInternal = {
  sourceError?: Error;
};

/**
 * Web Response as a simple object
 */
export class WebResponse<B = unknown> {

  /**
   * Build WebResponse based on return value
   */
  static defaultContentType(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    } else if (typeof value === 'string') {
      return 'text/plain';
    } else if (
      value instanceof Blob || Buffer.isBuffer(value) || BinaryUtil.isReadable(value) ||
      isArrayBuffer(value) || isReadableStream(value) || isAsyncIterable(value)
    ) {
      return DEFAULT_TYPE;
    } else if (value instanceof FormData) {
      return 'multipart/form-data';
    } else {
      return 'application/json';
    }
  }

  /** Serialize file/blob */
  static toBlobResponse(res: WebResponse<Blob>): WebResponse<BinaryBody> {
    const value = res.body;
    const meta = BinaryUtil.getBlobMeta(value);

    const toAdd: Record<string, string> = {};

    toAdd['Content-Length'] = `${value.size}`;

    if (meta?.range) {
      toAdd['Accept-Ranges'] = 'bytes';
      toAdd['Content-range'] = `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`;
    }

    meta?.contentEncoding && (toAdd['Content-Encoding'] = meta.contentEncoding);
    meta?.cacheControl && (toAdd['Cache-Control'] = meta.cacheControl);
    meta?.contentLanguage && (toAdd['Content-Language'] = meta.contentLanguage);

    if (value instanceof File && value.name) {
      toAdd['Content-disposition'] = `attachment; filename="${value.name}"`;
    }

    return new WebResponse({
      body: res.body,
      headers: [
        ...res.headers.entries(),
        ...Object.entries(toAdd)
      ],
      statusCode: res.statusCode,
      cookies: res.getCookies(),
    });
  }

  /** Get response from form data */
  static toFormDataResponse(res: WebResponse<FormData>): WebResponse<BinaryBody> {
    const boundary = `-------------------------multipart-${Util.uuid()}`;
    const nl = '\r\n';

    const source = (async function* (): AsyncIterable<Buffer | string> {
      for (const [k, v] of res.body.entries()) {
        const data = v.slice();
        const filename = data instanceof File ? data.name : undefined;
        const size = data instanceof Blob ? data.size : data.length;
        const type = data instanceof Blob ? data.type : undefined;
        yield `--${boundary}${nl}`;
        yield `Content-Disposition: form-data; name="${k}"; filename="${filename ?? k}"${nl}`;
        yield `Content-Length: ${size}${nl}`;
        if (type) {
          yield `Content-Type: ${type}${nl}`;
        }
        yield nl;
        if (data instanceof Blob) {
          for await (const chunk of data.stream()) {
            yield chunk;
          }
        } else {
          yield data;
        }
        yield nl;
      }
      yield `--${boundary}--${nl}`;
    });

    return new WebResponse({
      headers: [
        ...res.headers.entries(),
        ['Content-Type', `multipart/form-data; boundary=${boundary}`]
      ],
      statusCode: res.statusCode,
      cookies: res.getCookies(),
      body: Readable.from(source())
    });
  }

  static toBinaryResponse(res: WebResponse): WebResponse<BinaryBody> {
    const body = res.body;
    let out: Readable | Buffer;
    if (Buffer.isBuffer(body) || isReadableStream(body)) {
      return castTo(res);
    }
    if (body === undefined || body === null) {
      out = Buffer.alloc(0);
    } else if (typeof body === 'string') {
      out = Buffer.from(body, 'utf8');
    } else if (Buffer.isBuffer(body) || isArrayBuffer(body)) {
      out = Buffer.isBuffer(body) ? body : Buffer.from(body);
    } else if (BinaryUtil.isReadable(body) || isReadableStream(body)) {
      out = isReadableStream(body) ? Readable.fromWeb(body) : body;
    } else if (body instanceof Error) {
      const text = JSON.stringify(hasToJSON(body) ? body.toJSON() : { message: body.message });
      out = Buffer.from(text, 'utf-8');
    } else if (body instanceof Blob) {
      return this.toBlobResponse(castTo(res));
    } else if (isAsyncIterable(body)) {
      out = Readable.from(body);
    } else if (body instanceof FormData) {
      return this.toFormDataResponse(castTo(res));
    } else {
      const text = JSON.stringify(hasToJSON(body) ? body.toJSON() : body);
      out = Buffer.from(text, 'utf-8');
    }

    return new WebResponse({
      headers: res.headers,
      body: out,
      cookies: res.getCookies(),
      statusCode: res.statusCode
    });
  }

  /**
    * Build the redirect
    * @param location Location to redirect to
    * @param status Status code
    */
  static redirect(location: string, status = 302): WebResponse {
    return new WebResponse({ body: null, statusCode: status, headers: { Location: location } });
  }

  /** Get source error */
  static getSourceError(res: WebResponse): Error | undefined {
    return res[WebInternalSymbol].sourceError;
  }

  /** From catch value */
  static fromCatch(err: unknown): WebResponse {
    if (err instanceof WebResponse) {
      return err;
    }
    const error = (err instanceof Error) ?
      err :
      (!!err && typeof err === 'object' && ('message' in err && typeof err.message === 'string')) ?
        new AppError(err.message, { details: err }) :
        new AppError(`${err}`);
    return new WebResponse({ body: error });
  }

  [WebInternalSymbol]: WebResponseInternal = {};

  #cookies: Record<string, Cookie> = {};
  statusCode?: number;
  body: B;
  readonly headers: WebHeaders;

  constructor(o: WebResponseInput) {
    this.statusCode ??= o.statusCode;
    this.#cookies = Object.fromEntries(o.cookies?.map(x => [x.name, x]) ?? []);
    this.body = castTo(o.body);

    // Handle errors
    if (this.body instanceof Error) {
      const error: ErrorResponse = this.body;
      this.statusCode ??= error.status ?? error.statusCode ?? CATEGORY_STATUS[error.category!] ?? 500;
      this[WebInternalSymbol].sourceError = error;
    }

    this.headers = new WebHeaders(o.headers);

    if (!this.headers.has('Content-Type')) {
      this.headers.set('Content-Type', WebBodyUtil.defaultContentType(o.body));
    }
  }

  vary(value: string): void {
    this.headers.append('Vary', value);
  }

  get length(): number | undefined {
    return Buffer.isBuffer(this.body) ?
      this.body.length :
      (this.headers.has('Content-Length') ? +this.headers.get('Content-Length')! : undefined);
  }

  /**
   * Ensure content length matches the provided length of the source
   */
  ensureContentLength(): this {
    const len = this.length;
    if (len) {
      this.headers.set('Content-Length', `${len}`);
    } else {
      this.headers.delete('Content-Type');
    }
    return this;
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
    return WebResponse.toBinaryResponse(this);
  }

  /**
   * Get the body as a bufffer
   */
  async getBodyAsBuffer(this: WebResponse<Buffer | Readable>): Promise<Buffer> {
    return !this.body ? Buffer.alloc(0) : (Buffer.isBuffer(this.body) ? this.body : buffer(this.body));
  }
}