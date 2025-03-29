import { Readable } from 'node:stream';
import { isArrayBuffer } from 'node:util/types';
import type { IncomingHttpHeaders } from 'node:http';

import { AppError, BinaryUtil, castTo, ErrorCategory, hasFunction, hasToJSON } from '@travetto/runtime';

import { HttpMetadataConfig } from './common';
import { HttpHeaders } from './headers';
import { Cookie } from './cookie';

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

type PayloadInput<S> = {
  output: Buffer | Readable;
  length?: number;
  statusCode?: number;
  source?: S;
  emptyStatusCode?: number;
  contentType?: string;
  defaultContentType?: string;
  headers?: IncomingHttpHeaders | HttpHeaders;
  cookies?: Cookie[];
};

/**
 * Http Payload as a simple object
 */
export class HttpResponse<S = unknown> {

  /**
    * Build the redirect
    * @param location Location to redirect to
    * @param status Status code
    */
  static redirect(location: string, status = 302): HttpResponse<void> {
    return this.fromEmpty().with({
      statusCode: status,
      headers: { Location: location },
    });
  }

  /**
   * Standard stream
   */
  static fromStream<T extends Readable | ReadableStream>(value: T, contentType?: string): HttpResponse<T> {
    const output: Readable = isReadableStream(value) ? Readable.fromWeb(value) : value;
    return new HttpResponse({ output, source: value, contentType, defaultContentType: BINARY_TYPE });
  }

  /**
   * Standard iterable
   */
  static fromAsyncIterable<T extends AsyncIterable<unknown>>(value: T, contentType?: string): HttpResponse<T> {
    const output: Readable = Readable.from(value);
    return new HttpResponse({ output, source: value, contentType, defaultContentType: BINARY_TYPE });
  }

  /**
   * Return an empty payload
   */
  static fromEmpty(): HttpResponse<void> {
    return castTo(this.fromBytes(Buffer.alloc(0)));
  }

  /**
   * Standard text
   */
  static fromText<T extends string>(value: T, encoding: BufferEncoding = 'utf8', contentType?: string): HttpResponse<T> {
    const output = Buffer.from(value, encoding);
    return new HttpResponse({ output, length: output.byteLength, source: value, contentType, defaultContentType: 'text/plain' });
  }

  /**
   * Standard array of bytes (buffer)
   */
  static fromBytes<T extends Buffer | ArrayBuffer>(value: T, contentType?: string): HttpResponse<T> {
    const narrowed = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return new HttpResponse({ output: narrowed, length: narrowed.byteLength, source: value, contentType, defaultContentType: BINARY_TYPE });
  }

  /**
   * Standard json
   */
  static fromJSON<T extends unknown>(value: T, contentType?: string): HttpResponse<T> {
    const payload = JSON.stringify(hasToJSON(value) ? value.toJSON() : value);
    const output = Buffer.from(payload, 'utf-8');
    return new HttpResponse({ output, source: value, length: output.byteLength, contentType, defaultContentType: 'application/json' });
  }

  /**
   * Serialize file/blob
   */
  static fromBlob<T extends Blob>(value: T): HttpResponse<T> {
    const meta = BinaryUtil.getBlobMeta(value);

    const out = new HttpResponse<T>({
      source: value,
      output: Readable.fromWeb(value.stream()),
      length: value.size,
      contentType: meta?.contentType ?? BINARY_TYPE
    });

    if (meta?.range) {
      out.statusCode = 206;
      out.headers.set('accept-ranges', 'bytes');
      out.headers.set('Content-range', `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`);
    }

    meta?.contentEncoding && out.headers.set('Content-encoding', meta.contentEncoding);
    meta?.cacheControl && out.headers.set('cache-control', meta.cacheControl);
    meta?.contentLanguage && out.headers.set('Content-Language', meta.contentLanguage);

    if (value instanceof File && value.name) {
      out.headers.set('Content-disposition', `attachment; filename="${value.name}"`);
    }

    return out;
  }

  /**
   * From catch value
   */
  static fromCatch(err: unknown): HttpResponse<Error> {
    if (err instanceof HttpResponse) {
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
  static fromError<T extends ErrorResponse>(error: T): HttpResponse<T> {
    const output = this.fromJSON(hasToJSON(error) ? error : { message: error.message });
    return new HttpResponse({
      ...output,
      source: error,
      contentType: 'application/json',
      statusCode: error.status ?? error.statusCode ?? CATEGORY_STATUS[error.category!] ?? 500,
    });
  }

  /**
   * Determine payload based on output
   */
  static from<T>(value: T): HttpResponse<T> {
    if (value === undefined || value === null) {
      return castTo(this.fromEmpty());
    } else if (value instanceof HttpResponse) {
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
    } else {
      return this.fromJSON(value);
    }
  }

  #cookies: Record<string, Cookie> = {};
  #defaultContentType: string;

  statusCode?: number;
  source?: S;
  output: Buffer | Readable;
  length?: number;
  headers: HttpHeaders;

  constructor(o: PayloadInput<S>) {
    this.output = o.output;
    this.length = o.length;
    this.source = o.source;
    this.#defaultContentType = o.defaultContentType ?? BINARY_TYPE;
    this.with(o);
    if (o.contentType && this.length !== 0) {
      this.headers.set('Content-Type', o.contentType);
    }
  }

  with(o: Pick<PayloadInput<S>, 'headers' | 'cookies' | 'statusCode'>): this {
    this.statusCode ??= o.statusCode;
    this.#cookies = Object.fromEntries(o.cookies?.map(x => [x.name, x]) ?? []);
    this.headers = HttpHeaders.fromInput(o.headers);
    return this;
  }

  vary(value: string): void {
    this.headers.append('Vary', value);
  }

  ensureContentLength(): this {
    if (this.length) {
      this.headers.set('Content-Length', `${this.length} `);
    } else if (this.length === 0) {
      this.headers.delete('Content-Type');
    } else {
      this.headers.delete('Content-Length');
    }
    return this;
  }

  ensureContentType(): this {
    if (!this.headers.has('Content-Type') && this.length) {
      this.headers.set('Content-Type', this.#defaultContentType);
    }
    return this;
  }

  ensureStatusCode(emptyStatusCode = 200): this {
    if (!this.statusCode) {
      if (this.length === 0) {  // On empty response
        this.statusCode = emptyStatusCode;
      } else {
        this.statusCode = 200;
      }
    }
    return this;
  }

  getCookie(key: string): string | undefined {
    return this.#cookies[key].value;
  }

  hasCookie(key: string): boolean {
    return key in this.#cookies;
  }

  setCookie(cookie: Cookie): void {
    this.#cookies[cookie.name] = { ...cookie, maxAge: (cookie.value !== undefined) ? cookie.maxAge : -1 };
  }

  getCookies(): Cookie[] {
    return Object.values(this.#cookies);
  }

  /**
   * Write value to response
   */
  writeMetadata(cfg: HttpMetadataConfig, output: string | undefined, opts?: Omit<Cookie, 'name' | 'value'>): this {
    if (cfg.mode === 'cookie' || !cfg.mode) {
      this.setCookie({
        name: cfg.cookie,
        value: output,
        ...opts,
        maxAge: (output !== undefined) ? opts?.maxAge : -1,
      });
    }
    if (cfg.mode === 'header') {
      if (output) {
        this.headers.set(cfg.header, cfg.headerPrefix ? `${cfg.headerPrefix} ${output}` : output);
      } else {
        this.headers.delete(cfg.header);
      }
    }
    return this;
  }
}
