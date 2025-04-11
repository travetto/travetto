import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import { AppError, BinaryUtil, castTo, ErrorCategory, hasFunction, hasToJSON, Util } from '@travetto/runtime';

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
   * Generate multipart body
   */
  static async * buildMultiPartBody(form: FormData, boundary: string): AsyncIterable<Buffer | string> {
    const nl = '\r\n';
    for (const [k, v] of form.entries()) {
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
  }

  /** Get Blob Headers */
  static getBlobHeaders(value: Blob): [string, string][] {
    const meta = BinaryUtil.getBlobMeta(value);

    const toAdd: [string, string | undefined][] = [
      ['Content-Length', `${value.size}`],
      ['Content-Encoding', meta?.contentEncoding],
      ['Cache-Control', meta?.cacheControl],
      ['Content-Language', meta?.contentLanguage],
    ];

    if (meta?.range) {
      toAdd.push(
        ['Accept-Ranges', 'bytes'],
        ['Content-range', `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`],
      );
    }

    if (value instanceof File && value.name) {
      toAdd.push(['Content-disposition', `attachment; filename="${value.name}"`]);
    }

    return toAdd.filter((x): x is [string, string] => !!x[1]);
  }

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
    const body = this.body;
    if (Buffer.isBuffer(body) || isReadableStream(body)) {
      return castTo(this);
    }
    let headers = this.headers;
    let statusCode = this.statusCode;
    let out: Readable | Buffer;
    let extraHeaders: [string, string][] | undefined;

    if (body === undefined || body === null) {
      out = Buffer.alloc(0);
    } else if (typeof body === 'string') {
      out = Buffer.from(body, 'utf8');
    } else if (isArrayBuffer(body)) {
      out = Buffer.from(body);
    } else if (isReadableStream(body)) {
      out = Readable.fromWeb(body);
    } else if (body instanceof Error) {
      const text = JSON.stringify(hasToJSON(body) ? body.toJSON() : { message: body.message });
      out = Buffer.from(text, 'utf-8');
    } else if (body instanceof Blob) {
      const meta = BinaryUtil.getBlobMeta(body);
      statusCode = meta?.range ? 206 : statusCode;
      extraHeaders = WebResponse.getBlobHeaders(body);
      out = Readable.fromWeb(body.stream());
    } else if (isAsyncIterable(body)) {
      out = Readable.from(body);
    } else if (body instanceof FormData) {
      const boundary = `-------------------------multipart-${Util.uuid()}`;
      extraHeaders = [['Content-Type', `multipart/form-data; boundary=${boundary}`]];
      out = Readable.from(WebResponse.buildMultiPartBody(body, boundary));
    } else {
      const text = JSON.stringify(hasToJSON(body) ? body.toJSON() : body);
      out = Buffer.from(text, 'utf-8');
    }
    if (extraHeaders) {
      headers = new WebHeaders([...headers.entries(), ...extraHeaders]);
    }
    return new WebResponse({ headers, body: out, cookies: this.getCookies(), statusCode });
  }

  /**
   * Get the body as a bufffer
   */
  async getBodyAsBuffer(this: WebResponse<Buffer | Readable>): Promise<Buffer> {
    return !this.body ? Buffer.alloc(0) : (Buffer.isBuffer(this.body) ? this.body : buffer(this.body));
  }
}