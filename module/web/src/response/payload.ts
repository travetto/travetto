import { Readable } from 'node:stream';
import { isArrayBuffer } from 'node:util/types';

import { AppError, BinaryUtil, castTo, ErrorCategory, hasFunction, hasToJSON } from '@travetto/runtime';
import { SetOption } from 'cookies';
import { HttpMetadataConfig } from '../types';

type V = string | string[];
type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

const isStream = hasFunction<Readable>('pipe');
const isReadableStream = hasFunction<ReadableStream>('pipeTo');

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
  headers?: Record<string, string | string[]>;
  cookies?: Record<string, { value: string | undefined, options: SetOption }>;
};

/**
 * Http Payload as a simple object
 */
export class HttpPayload<S = unknown> {

  /**
    * Build the redirect
    * @param location Location to redirect to
    * @param status Status code
    */
  static redirect(location: string, status = 302): HttpPayload {
    return this.fromEmpty().with({
      statusCode: status,
      headers: { Location: location },
    });
  }

  /**
    * Standard stream
    */
  static fromStream<T extends Readable | ReadableStream>(value: T, contentType?: string): HttpPayload<T> {
    const output: Readable = isReadableStream(value) ? Readable.fromWeb(value) : value;
    return new HttpPayload({ output, source: value, contentType, defaultContentType: BINARY_TYPE });
  }

  /**
   * Return an empty payload
   */
  static fromEmpty(): HttpPayload<void> {
    return castTo(this.fromBytes(Buffer.alloc(0)));
  }

  /**
   * Standard text
   */
  static fromText<T extends string>(value: T, encoding: BufferEncoding = 'utf8', contentType?: string): HttpPayload<T> {
    const output = Buffer.from(value, encoding);
    return new HttpPayload({ output, length: output.byteLength, source: value, contentType, defaultContentType: 'text/plain' });
  }

  /**
   * Standard array of bytes (buffer)
   */
  static fromBytes<T extends Buffer | ArrayBuffer>(value: T, contentType?: string): HttpPayload<T> {
    const narrowed = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return new HttpPayload({ output: narrowed, length: narrowed.byteLength, source: value, contentType, defaultContentType: BINARY_TYPE });
  }

  /**
   * Standard json
   */
  static fromJSON<T extends unknown>(value: T, contentType?: string): HttpPayload<T> {
    const payload = JSON.stringify(hasToJSON(value) ? value.toJSON() : value);
    const output = Buffer.from(payload, 'utf-8');
    return new HttpPayload({ output, source: value, length: output.byteLength, contentType, defaultContentType: 'application/json' });
  }

  /**
   * Serialize file/blob
   */
  static fromBlob<T extends Blob>(value: T): HttpPayload<T> {
    const meta = BinaryUtil.getBlobMeta(value);

    const out = new HttpPayload<T>({
      source: value,
      output: Readable.fromWeb(value.stream()),
      length: value.size,
      contentType: meta?.contentType ?? BINARY_TYPE
    });

    const setIf = (k: string, v?: string): unknown => v ? out.setHeader(k, v) : undefined;

    if (meta?.range) {
      out.statusCode = 206;
      out.setHeader('Accept-Ranges', 'bytes');
      out.setHeader('Content-Range', `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`);
    }

    setIf('content-encoding', meta?.contentEncoding);
    setIf('cache-control', meta?.cacheControl);
    setIf('content-language', meta?.contentLanguage);

    if (value instanceof File && value.name) {
      out.setHeader('Content-Disposition', `attachment; filename="${value.name}"`);
    }

    return out;
  }

  /**
   * From basic error
   */
  static fromBasicError(err: unknown): HttpPayload<Error> {
    return this.fromError(err instanceof Error ? err : AppError.fromBasic(err));
  }

  /**
   * From Error
   */
  static fromError<T extends ErrorResponse>(error: T): HttpPayload<T> {
    const output = this.fromJSON(hasToJSON(error) ? error : { message: error.message });
    return new HttpPayload({
      ...output,
      source: error,
      contentType: 'application/json',
      statusCode: error.status ?? error.statusCode ?? CATEGORY_STATUS[error.category!] ?? 500,
    });
  }

  /**
   * Determine payload based on output
   */
  static from<T>(value: T): HttpPayload<T> {
    if (value === undefined || value === null) {
      return castTo(this.fromEmpty());
    } else if (value instanceof HttpPayload) {
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
    } else {
      return this.fromJSON(value);
    }
  }

  #headerNames: Record<string, string> = {};
  #headers: Record<string, string | string[]> = {};
  #cookies: Record<string, { value: string | undefined, options: SetOption }> = {};
  #defaultContentType: string;

  statusCode?: number;
  source?: S;
  output: Buffer | Readable;
  length?: number;

  constructor(o: PayloadInput<S>) {
    this.output = o.output;
    this.length = o.length;
    this.source = o.source;
    this.#defaultContentType = o.defaultContentType ?? BINARY_TYPE;
    this.with(o);
    if (o.contentType && this.length !== 0) {
      this.setHeader('Content-Type', o.contentType);
    }
  }

  with(o: Pick<PayloadInput<S>, 'headers' | 'cookies' | 'statusCode'>): this {
    this.statusCode ??= o.statusCode;
    this.#cookies = { ...o.cookies };
    this.#headers = { ...o.headers };
    this.#headerNames = Object.fromEntries(Object.keys(this.#headers).map(x => [x.toLowerCase(), x]));
    return this;
  }

  withHeaders(o: Record<string, string | (() => string)>): this {
    for (const [k, v] of Object.entries(o)) {
      this.setHeader(k, typeof v === 'function' ? v() : v);
    }
    return this;
  }

  getHeaderNames(): string[] {
    return [...Object.keys(this.#headers ?? {})];
  }

  setHeader(key: string, value: (() => V) | V): void {
    const lk = key.toLowerCase();
    const fk = this.#headerNames[lk] ??= key;
    this.#headers[fk] = typeof value === 'function' ? value() : value;
  }

  hasHeader(key: string): boolean {
    return key.toLowerCase() in this.#headerNames;
  }

  getHeader(key: string): V | undefined {
    return this.#headers![this.#headerNames[key.toLowerCase()]];
  }

  getHeaders(): Record<string, V> {
    return Object.freeze(this.#headers!);
  }

  removeHeader(key: string): void {
    const lk = key.toLowerCase();
    if (lk in this.#headerNames) {
      const fk = this.#headerNames[lk];
      delete this.#headers![fk];
      delete this.#headerNames[lk];
    }
  }

  vary(value: string): void {
    const header = this.getHeader('vary');
    if (!header?.includes(value)) {
      this.setHeader('vary', header ? `${header}, ${value}` : value);
    }
  }

  ensureContentLength(): this {
    if (this.length) {
      this.setHeader('Content-Length', `${this.length} `);
    } else if (this.length === 0) {
      this.removeHeader('Content-Type');
    } else {
      this.removeHeader('Content-Length');
    }
    return this;
  }

  ensureContentType(): this {
    if (!this.hasHeader('Content-Type') && this.length) {
      this.setHeader('Content-Type', this.#defaultContentType);
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

  setCookie(key: string, value: string | undefined, opts?: SetOption): void {
    this.#cookies[key] = {
      value, options: {
        ...opts,
        maxAge: (value !== undefined) ? undefined : -1,
      }
    };
  }

  getCookies(): Record<string, ({ value: string | undefined, options: SetOption })> {
    return Object.freeze(this.#cookies!);
  }


  /**
   * Write value to response
   */
  writeMetadata(cfg: HttpMetadataConfig, output: string | undefined, opts?: SetOption): this {
    if (cfg.mode === 'cookie' || !cfg.mode) {
      this.setCookie(cfg.cookie, output, {
        ...opts,
        maxAge: (output !== undefined) ? undefined : -1,
      });
    }
    if (cfg.mode === 'header') {
      if (output) {
        this.setHeader(cfg.header, cfg.headerPrefix ? `${cfg.headerPrefix} ${output}` : output);
      } else {
        this.removeHeader(cfg.header);
      }
    }
    return this;
  }
}

/**
 * Custom serialization contract
 */
export interface HttpSerializable<S = unknown> {
  /**
   * Serialize the output given a response.
   */
  serialize(): HttpPayload<S>;
}