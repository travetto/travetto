import { Readable } from 'node:stream';

import { BinaryUtil, ErrorCategory, hasFunction, hasToJSON } from '@travetto/runtime';

import { HttpSerializable } from '../response/serializable';
import { HttpResponse, HttpPayload } from '../types';
import { WebSymbols } from '../symbols';

type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

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
 * Utilities for serializing output
 */
export class SerializeUtil {
  static isSerializable = hasFunction<HttpSerializable>('serialize');
  static isStream = hasFunction<Readable>('pipe');

  /**
   * Set headers on response given a map
   * @param res
   * @param map
   */
  static setHeaders(res: HttpResponse, map?: Record<string, string | string[] | (() => string | string[])>): void {
    if (map) {
      for (const [key, value] of Object.entries(map)) {
        res.setHeader(key, typeof value === 'function' ? value() : value);
      }
    }
  }

  /**
   * Standard json
   */
  static fromJSON(output: unknown): HttpPayload {
    const val = hasToJSON(output) ? output.toJSON() : output;
    const data = JSON.stringify(val);
    return { defaultContentType: 'application/json', data, length: data.length };
  }

  /**
   * Serialize file/blob
   */
  static fromBlob(output: Blob | File): HttpPayload {
    const meta = BinaryUtil.getBlobMeta(output);
    const out: HttpPayload = {
      defaultContentType: 'application/octet-stream',
      data: Readable.fromWeb(output.stream()),
      headers: {}
    };

    if (meta) {
      out.statusCode = meta?.range ? 206 : 200;
      for (const [k, v] of Object.entries({
        'content-encoding': meta.contentEncoding,
        'cache-control': meta.cacheControl,
        'content-language': meta.contentLanguage,
        ...(meta.range ? {
          'accept-ranges': 'bytes',
          'content-range': `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`
        } : {})
      })) {
        if (v) {
          out.headers![k] = v;
        }
      }
    }

    if (output instanceof File && output.name) {
      out.headers!['content-disposition'] = `attachment;filename="${output.name}"`;
    }
    if (output.size) {
      out.length = output.size;
      out.headers!['content-length'] = `${output.size}`;
    }

    return out;
  }

  /**
   * Serialize Error
   */
  static fromError(error: ErrorResponse): HttpPayload {
    const output = this.fromJSON(hasToJSON(error) ? error.toJSON() : { message: error.message });
    return {
      ...output,
      headers: { ...output.headers, 'content-type': 'application/json' },
      statusCode: error.status ?? error.statusCode ?? CATEGORY_STATUS[error.category!] ?? 500,
    };
  }

  /**
   * Determine serialization type based on output
   */
  static serialize(output: unknown): HttpPayload {
    switch (typeof output) {
      case 'string': return { defaultContentType: 'text/plain', data: output, length: output.length };
      case 'number':
      case 'boolean':
      case 'bigint': return this.fromJSON(output);
      default: {
        if (!output) {
          return { data: '' };
        } else if (Buffer.isBuffer(output)) {
          return { defaultContentType: 'application/octet-stream', data: output, length: output.length };
        } else if (this.isStream(output)) {
          return { defaultContentType: 'application/octet-stream', data: output };
        } else if (output instanceof Error) {
          return this.fromError(output);
        } else if (output instanceof Blob) {
          return this.fromBlob(output);
        } else {
          return this.fromJSON(output);
        }
      }
    }
  }

  /**
   * Send response
   */
  static async send(response: HttpResponse, basic: HttpPayload): Promise<void> {
    // Set implicit headers
    this.setHeaders(response, response[WebSymbols.Internal].headersAdded);
    this.setHeaders(response, basic?.headers);

    // Set header if not defined
    if (basic?.defaultContentType && !response.getHeader('content-type')) {
      response.setHeader('content-type', basic.defaultContentType);
    }

    response.statusCode = basic.statusCode ?? response.statusCode ?? 200;

    if (!basic.data) {
      response.send('');
    } else if (Buffer.isBuffer(basic.data) || typeof basic.data === 'string') {
      response.send(basic);
    } else {
      await response.sendStream(basic.data);
    }
  }
}