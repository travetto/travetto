import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { isArrayBuffer } from 'node:util/types';

import { Any, BinaryUtil, castTo, ErrorCategory, hasFunction, hasToJSON } from '@travetto/runtime';

import { HttpPayload } from '../types';
import { HttpSerializable } from '../response/serializable';

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

/**
 * Utilities for generating HttpPayloads from various values
 */
export class HttpPayloadUtil {
  /**
   * Standard stream
   */
  static fromStream<T extends Readable | ReadableStream>(value: T, type?: string): HttpPayload<T> {
    const output: Readable = isReadableStream(value) ? Readable.fromWeb(value) : value;
    return new HttpPayload({ defaultContentType: type, output, source: value, headers: {} });
  }

  /**
   * Standard text
   */
  static fromText<T extends string>(value: T, type: string = 'text/plain', encoding: BufferEncoding = 'utf8'): HttpPayload<T> {
    const output = Buffer.from(value, encoding);
    return new HttpPayload({ defaultContentType: type, output, length: output.byteLength, source: value, headers: {} });
  }

  /**
   * Standard array of bytes (buffer)
   */
  static fromBytes<T extends Buffer | ArrayBuffer>(value: T, type?: string): HttpPayload<T> {
    const narrowed = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return new HttpPayload({ defaultContentType: type, output: narrowed, length: narrowed.byteLength, source: value, headers: {} });
  }

  /**
   * Standard json
   */
  static fromJSON<T extends unknown>(value: T): HttpPayload<T> {
    const payload = JSON.stringify(hasToJSON(value) ? value.toJSON() : value);
    const output = Buffer.from(payload, 'utf-8');
    return new HttpPayload({ defaultContentType: 'application/json', headers: {}, output, source: value, length: output.byteLength });
  }

  /**
   * Serialize file/blob
   */
  static fromBlob<T extends Blob>(value: T): HttpPayload<T> {
    const meta = BinaryUtil.getBlobMeta(value);
    const out = new HttpPayload<T>({ source: value, output: Readable.fromWeb(value.stream()), headers: {}, length: value.size });

    const headers = out.headers ??= {};
    const setIf = (k: string, v?: string): unknown => v ? headers[k] = v : undefined;

    if (meta?.range) {
      out.statusCode = 206;
      headers['accept-ranges'] = 'bytes';
      headers['content-range'] = `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`;
    }

    setIf('content-encoding', meta?.contentEncoding);
    setIf('cache-control', meta?.cacheControl);
    setIf('content-language', meta?.contentLanguage);

    if (value instanceof File && value.name) {
      headers['content-disposition'] = `attachment;filename="${value.name}"`;
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
      headers: { ...output.headers, 'content-type': 'application/json' },
      statusCode: error.status ?? error.statusCode ?? CATEGORY_STATUS[error.category!] ?? 500,
    });
  }

  /**
   * Determine payload based on output
   */
  static from<T>(value: T): HttpPayload<T> {
    if (value === undefined || value === null) {
      return castTo(this.fromText(''));
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
}