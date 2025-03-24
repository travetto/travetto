import { Readable } from 'node:stream';
import { isArrayBuffer } from 'node:util/types';

import { Any, BinaryUtil, castTo, ErrorCategory, hasFunction, hasToJSON } from '@travetto/runtime';

type V = string | string[];
type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

const isStream = hasFunction<Readable>('pipe');
const isReadableStream = hasFunction<ReadableStream>('pipeTo');
const isSerializable = hasFunction<HttpSerializable>('serialize');

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
  defaultContentType?: string;
  length?: number;
  statusCode?: number;
  source?: S;
  emptyStatusCode?: number;
  headers?: Record<string, string | string[]>;
};

/**
 * Http Payload as a simple object
 */
export class HttpPayload<S = unknown> {
  /**
    * Standard stream
    */
  static fromStream<T extends Readable | ReadableStream>(value: T, type?: string): HttpPayload<T> {
    const output: Readable = isReadableStream(value) ? Readable.fromWeb(value) : value;
    return new HttpPayload({ defaultContentType: type, output, source: value });
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
  static fromText<T extends string>(value: T, type: string = 'text/plain', encoding: BufferEncoding = 'utf8'): HttpPayload<T> {
    const output = Buffer.from(value, encoding);
    return new HttpPayload({ defaultContentType: type, output, length: output.byteLength, source: value });
  }

  /**
   * Standard array of bytes (buffer)
   */
  static fromBytes<T extends Buffer | ArrayBuffer>(value: T, type?: string): HttpPayload<T> {
    const narrowed = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return new HttpPayload({ defaultContentType: type, output: narrowed, length: narrowed.byteLength, source: value });
  }

  /**
   * Standard json
   */
  static fromJSON<T extends unknown>(value: T): HttpPayload<T> {
    const payload = JSON.stringify(hasToJSON(value) ? value.toJSON() : value);
    const output = Buffer.from(payload, 'utf-8');
    return new HttpPayload({ defaultContentType: 'application/json', output, source: value, length: output.byteLength });
  }

  /**
   * Serialize file/blob
   */
  static fromBlob<T extends Blob>(value: T): HttpPayload<T> {
    const meta = BinaryUtil.getBlobMeta(value);
    const out = new HttpPayload<T>({ source: value, output: Readable.fromWeb(value.stream()), length: value.size });
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
   * From Error
   */
  static fromError<T extends ErrorResponse>(error: T): HttpPayload<T> {
    const output = this.fromJSON(hasToJSON(error) ? error : { message: error.message });
    return new HttpPayload({
      ...output,
      source: error,
      headers: { ...output.#headers, 'content-type': 'application/json' },
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
      return this.fromText(value, 'text/plain');
    } else if (Buffer.isBuffer(value) || isArrayBuffer(value)) {
      return this.fromBytes(value);
    } else if (isStream(value) || isReadableStream(value)) {
      return this.fromStream(value);
    } else if (value instanceof Error) {
      return this.fromError(value);
    } else if (value instanceof Blob) {
      return this.fromBlob(value);
    } else if (isSerializable(value)) {
      return castTo<HttpPayload<Any>>(value.serialize());
    } else {
      return this.fromJSON(value);
    }
  }

  #headerNames: Record<string, string> = {};
  #headers: Record<string, string | string[]> = {};

  defaultContentType?: string;
  statusCode?: number;
  source?: S;
  output: Buffer | Readable;
  length?: number;

  constructor(o: PayloadInput<S>) {
    this.output = o.output;
    this.length = o.length;
    this.source = o.source;
    this.with(o);

  }

  with(o: Pick<PayloadInput<S>, 'headers' | 'defaultContentType' | 'statusCode'>): this {
    this.statusCode ??= o.statusCode;
    this.defaultContentType = o.defaultContentType;
    this.#headers = { ...o.headers };
    this.#headerNames = Object.fromEntries(Object.keys(this.#headers).map(x => [x.toLowerCase(), x]));
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

  setHeadersIfMissing(data: Record<string, (() => V) | V>): this {
    for (const [key, value] of Object.entries(data)) {
      if (!(key.toLowerCase() in this.#headerNames)) {
        this.setHeader(key, value);
      }
    }
    return this;
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
    if (!this.getHeader('Content-Type') && this.length) {
      this.setHeader('Content-Type', this.defaultContentType ?? 'application/octet-stream');
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