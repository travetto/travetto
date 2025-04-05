import { Readable } from 'node:stream';
import { isArrayBuffer } from 'node:util/types';

import { AppError, BinaryUtil, castTo, ErrorCategory, hasFunction, hasToJSON, Util } from '@travetto/runtime';

import { Cookie } from './cookie.ts';
import { WebHeadersInit, WebHeaders } from './headers.ts';

type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

const isStream = hasFunction<Readable>('pipe');
const isReadableStream = hasFunction<ReadableStream>('pipeTo');
const isAsyncIterable = (v: unknown): v is AsyncIterable<unknown> =>
  !!v && (typeof v === 'object' || typeof v === 'function') && Symbol.asyncIterator in v;

const BINARY_TYPE = 'application/octet-stream';

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

export type WebResponseInput<S> = {
  body: Buffer | Readable;
  length?: number;
  statusCode?: number;
  source?: S;
  contentType?: string;
  defaultContentType?: string;
  headers?: WebHeadersInit;
  cookies?: Cookie[];
};

/**
 * Web Response as a simple object
 */
export class WebResponse<S = unknown> {

  /**
    * Build the redirect
    * @param location Location to redirect to
    * @param status Status code
    */
  static redirect(location: string, status = 302): WebResponse<void> {
    return this.fromEmpty().with({
      statusCode: status,
      headers: { Location: location },
    });
  }

  /**
   * Standard stream
   */
  static fromStream<T extends Readable | ReadableStream>(value: T, contentType?: string): WebResponse<T> {
    const body: Readable = isReadableStream(value) ? Readable.fromWeb(value) : value;
    return new WebResponse({ body, source: value, contentType, defaultContentType: BINARY_TYPE });
  }

  /**
   * Standard iterable
   */
  static fromAsyncIterable<T extends AsyncIterable<unknown>>(value: T, contentType?: string): WebResponse<T> {
    const body: Readable = Readable.from(value);
    return new WebResponse({ body, source: value, contentType, defaultContentType: BINARY_TYPE });
  }

  /**
   * Return an empty payload
   */
  static fromEmpty(): WebResponse<void> {
    return castTo(this.fromBytes(Buffer.alloc(0)));
  }

  /**
   * Standard text
   */
  static fromText<T extends string>(value: T, encoding: BufferEncoding = 'utf8', contentType?: string): WebResponse<T> {
    const body = Buffer.from(value, encoding);
    return new WebResponse({ body, length: body.byteLength, source: value, contentType, defaultContentType: 'text/plain' });
  }

  /**
   * Standard array of bytes (buffer)
   */
  static fromBytes<T extends Buffer | ArrayBuffer>(value: T, contentType?: string): WebResponse<T> {
    const body = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return new WebResponse({ body, length: body.byteLength, source: value, contentType, defaultContentType: BINARY_TYPE });
  }

  /**
   * Standard json
   */
  static fromJSON<T extends unknown>(value: T, contentType?: string): WebResponse<T> {
    const payload = JSON.stringify(hasToJSON(value) ? value.toJSON() : value);
    const body = Buffer.from(payload, 'utf-8');
    return new WebResponse({ body, source: value, length: body.byteLength, contentType, defaultContentType: 'application/json' });
  }

  /**
   * Serialize file/blob
   */
  static fromBlob<T extends Blob>(value: T): WebResponse<T> {
    const meta = BinaryUtil.getBlobMeta(value);

    const out = new WebResponse<T>({
      source: value,
      body: Readable.fromWeb(value.stream()),
      length: value.size,
      contentType: meta?.contentType ?? BINARY_TYPE
    });

    if (meta?.range) {
      out.statusCode = 206;
      out.headers.set('accept-ranges', 'bytes');
      out.headers.set('Content-range', `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`);
    }

    meta?.contentEncoding && out.headers.set('Content-encoding', meta.contentEncoding);
    meta?.cacheControl && out.headers.set('Cache-Control', meta.cacheControl);
    meta?.contentLanguage && out.headers.set('Content-Language', meta.contentLanguage);

    if (value instanceof File && value.name) {
      out.headers.set('Content-disposition', `attachment; filename="${value.name}"`);
    }

    return out;
  }

  /**
   * From catch value
   */
  static fromCatch(err: unknown): WebResponse<Error> {
    if (err instanceof WebResponse) {
      return err;
    } else if (err instanceof Error) {
      return this.fromError(err);
    } else if (!!err && typeof err === 'object' && ('message' in err && typeof err.message === 'string')) {
      return this.fromError(new AppError(err.message, { details: err }));
    } else {
      return this.fromError(new AppError(`${err}`));
    }
  }

  /**
   * From Error
   */
  static fromError<T extends ErrorResponse>(error: T): WebResponse<T> {
    const response = this.fromJSON(hasToJSON(error) ? error : { message: error.message }).with({
      contentType: 'application/json',
      statusCode: error.status ?? error.statusCode ?? CATEGORY_STATUS[error.category!] ?? 500,
    });
    response.source = error;
    return castTo(response);
  }

  /**
   * Get response from form data
   */
  static fromFormData<T extends FormData>(form: T): WebResponse<T> {
    const boundary = `-------------------------multipart-${Util.uuid()}`;
    const nl = '\r\n';

    const source = (async function* (): AsyncIterable<Buffer | string> {
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
    });

    const tap = async function* () {
      for await (const item of source()) {
        console.error(item);
        yield item;
      }
    }

    return new WebResponse({
      body: Readable.from(tap()),
      contentType: `multipart/form-data; boundary=${boundary}`,
      source: form
    });
  }

  /**
   * Build WebResponse based on return value
   */
  static from<T>(value: T): WebResponse<T> {
    if (value === undefined || value === null) {
      return castTo(this.fromEmpty());
    } else if (value instanceof WebResponse) {
      return value;
    } else if (typeof value === 'string') {
      return this.fromText(value);
    } else if (Buffer.isBuffer(value) || isArrayBuffer(value)) {
      return this.fromBytes(value);
    } else if (isStream(value) || isReadableStream(value)) {
      return this.fromStream(value);
    } else if (value instanceof Error) {
      return this.fromError(value);
    } else if (value instanceof Blob) {
      return this.fromBlob(value);
    } else if (isAsyncIterable(value)) {
      return this.fromAsyncIterable(value);
    } else if (value instanceof FormData) {
      return this.fromFormData(value);
    } else {
      return this.fromJSON(value);
    }
  }

  #cookies: Record<string, Cookie> = {};
  #defaultContentType: string;

  statusCode?: number;
  source?: S;
  body: Buffer | Readable;
  length?: number;
  readonly headers: WebHeaders;

  constructor(o: WebResponseInput<S>) {
    this.body = o.body;
    this.length = o.length;
    this.source = o.source;
    this.with(o);
  }

  with(o: Pick<WebResponseInput<S>, 'headers' | 'cookies' | 'statusCode' | 'contentType' | 'defaultContentType'>): this {
    this.statusCode ??= o.statusCode;
    this.#cookies = Object.fromEntries(o.cookies?.map(x => [x.name, x]) ?? []);
    this.#defaultContentType = o.defaultContentType ?? BINARY_TYPE;

    // @ts-expect-error
    this.headers = new WebHeaders(o.headers);

    if (o.contentType) {
      this.headers.set('Content-Type', o.contentType);
    }
    return this;
  }

  vary(value: string): void {
    this.headers.append('Vary', value);
  }

  /**
   * Ensure content length matches the provided length of the source
   */
  ensureContentLength(): this {
    if (this.length !== undefined) {
      this.headers.set('Content-Length', `${this.length}`);
      if (!this.length) {
        this.headers.delete('Content-Type');
      }
    } else {
      this.headers.delete('Content-Length');
    }
    return this;
  }

  /**
   * Ensure content type exists, if length is provided
   * Fall back to the default type if not provided
   */
  ensureContentType(): this {
    if (!this.headers.has('Content-Type') && this.length) {
      this.headers.set('Content-Type', this.#defaultContentType);
    } else if (this.length === 0) {
      this.headers.delete('Content-Type');
    }
    return this;
  }

  /**
   * Ensure status code is set
   */
  ensureStatusCode(emptyStatusCode = 204): this {
    this.statusCode ??= (this.length === 0 ? emptyStatusCode : 200);
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
}
