import { Readable } from 'node:stream';

import { BinaryUtil, ErrorCategory, hasFunction, hasToJSON } from '@travetto/runtime';

import { HttpRequest, HttpResponse, WebInternal } from '../types';

type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

const isStream = hasFunction<Readable>('pipe');

interface HttpPayload {
  headers?: Record<string, string>;
  defaultContentType?: string;
  statusCode?: number;
  data: Readable | Buffer;
  length?: number;
};

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
  static fromStream(value: Readable, type?: string): HttpPayload {
    return { defaultContentType: type, data: value };
  }

  /**
   * Standard array of bytes (buffer, string)
   */
  static fromBytes(value: Buffer | string, type?: string): HttpPayload {
    value = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    return { defaultContentType: type, data: value, length: value.length };
  }

  /**
   * Standard json
   */
  static fromJSON(value: unknown): HttpPayload {
    return this.fromBytes(JSON.stringify(hasToJSON(value) ? value.toJSON() : value), 'application/json');
  }

  /**
   * Serialize file/blob
   */
  static fromBlob(value: Blob | File): HttpPayload {
    const meta = BinaryUtil.getBlobMeta(value);
    const out = this.fromStream(Readable.fromWeb(value.stream()));
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

    out.length = value.size;

    return out;
  }

  /**
   * From Error
   */
  static fromError(error: ErrorResponse): HttpPayload {
    const output = this.fromJSON(hasToJSON(error) ? error : { message: error.message });
    return {
      ...output,
      headers: { ...output.headers, 'content-type': 'application/json' },
      statusCode: error.status ?? error.statusCode ?? CATEGORY_STATUS[error.category!] ?? 500,
    };
  }

  /**
   * Determine payload based on output
   */
  static from(value: unknown): HttpPayload {
    if (value === undefined || value === null) {
      return this.fromBytes('');
    } else if (typeof value === 'string') {
      return this.fromBytes(value, 'text/plain');
    } else if (Buffer.isBuffer(value)) {
      return this.fromBytes(value);
    } else if (isStream(value)) {
      return this.fromStream(value);
    } else if (value instanceof Error) {
      return this.fromError(value);
    } else if (value instanceof Blob) {
      return this.fromBlob(value);
    } else {
      return this.fromJSON(value);
    }
  }

  /**
   * Applies payload to the response
   */
  static applyPayload(payload: HttpPayload, req: HttpRequest, res: HttpResponse): void {
    const { length, defaultContentType, headers, data, statusCode } = payload;

    for (const map of [res[WebInternal].headersAdded, headers]) {
      for (const [key, value] of Object.entries(map ?? {})) {
        res.setHeader(key, typeof value === 'function' ? value() : value);
      }
    }

    // Set header if not defined
    if (!res.getHeader('Content-type')) {
      res.setHeader('Content-type', defaultContentType ?? 'application/octet-stream');
    }

    // Set length if provided
    if (length !== undefined) {
      res.setHeader('Content-Length', `${length} `);
    }

    res[WebInternal].body = data;

    if (!statusCode) {
      if (length === 0) {  // On empty response
        res.statusCode = (req.method === 'POST' || req.method === 'PUT') ? 201 : 204;
      } else {
        res.statusCode = 200;
      }
    } else {
      res.statusCode = statusCode;
    }
  }
}