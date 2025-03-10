import { Readable } from 'node:stream';

import { BinaryUtil, ErrorCategory, hasFunction, hasToJSON } from '@travetto/runtime';

import { Renderable } from '../response/renderable';
import { HttpRequest, HttpResponse } from '../types';

type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

export type SerializedResult = {
  headers?: Record<string, string>;
  defaultContentType?: string;
  statusCode?: number;
  data: Readable | Buffer | string;
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
 * Utilities for serializing output
 */
export class SerializeUtil {
  static isRenderable = hasFunction<Renderable>('render');
  static isStream = hasFunction<Readable>('pipe');

  /**
   * Convert headers to standard map
   */
  static convertHeaders(headers?: Record<string, string | (() => string)>): Record<string, string | string> | undefined {
    if (headers) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        out[k] = typeof v === 'string' ? v : v();
      }
      return out;
    }
  }

  /**
   * Standard json
   */
  static serializeJSON(output: unknown, forceHeader = false): SerializedResult {
    const val = hasToJSON(output) ? output.toJSON() : output;
    return {
      ...forceHeader ? {
        headers: { 'Content-Type': 'application/json' }
      } : {
        defaultContentType: 'application/json'
      },
      data: JSON.stringify(val)
    };
  }

  /**
   * Primitive json
   */
  static serializePrimitive(output: unknown): SerializedResult {
    return { defaultContentType: 'application/json', data: JSON.stringify(output) };
  }

  /**
   * Serialize text
   */
  static serializeText(output: string): SerializedResult {
    return { defaultContentType: 'text/plain', data: output };
  }

  /**
   * Serialize buffer
   */
  static serializeBuffer(output: Buffer): SerializedResult {
    return { defaultContentType: 'application/octet-stream', data: output };
  }

  /**
   * Serialize stream
   */
  static serializeStream(output: Readable): SerializedResult {
    return { defaultContentType: 'application/octet-stream', data: output };
  }

  /**
   * Serialize file/blob
   */
  static serializeBlob(output: Blob | File): SerializedResult {
    const meta = BinaryUtil.getBlobMeta(output);
    const out: SerializedResult = {
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
      out.headers!['content-length'] = `${output.size}`;
    }

    return out;
  }

  /**
   * Send empty response
   */
  static serializeEmpty(): SerializedResult {
    return { data: '' };
  }

  /**
   * Serialize Error
   * @param error
   */
  static serializeError(error: ErrorResponse): SerializedResult {
    const output = this.serializeJSON(hasToJSON(error) ? error.toJSON() : { message: error.message }, true);
    output.statusCode = error.status ?? error.statusCode ?? CATEGORY_STATUS[error.category!] ?? 500;
    return output;
  }

  /**
   * Serialize renderable
   */
  static async serializeRenderable(req: HttpRequest, res: HttpResponse, output: Renderable): Promise<SerializedResult | undefined> {
    if (output.headers) {
      for (const [k, v] of Object.entries(output.headers())) {
        res.setHeader(k, v);
      }
    }
    if (output.statusCode) {
      res.status(output.statusCode());
    }
    const result = await output.render(res);
    if (result === undefined) { // If render didn't return a result, consider us done
      return;
    } else {
      return this.serializeStandard(result);
    }
  }

  /**
   * Determine serialization type based on output
   */
  static serializeStandard(output: unknown): SerializedResult | undefined {
    switch (typeof output) {
      case 'string': return this.serializeText(output);
      case 'number':
      case 'boolean':
      case 'bigint': return this.serializePrimitive(output);
      default: {
        if (!output) {
          return this.serializeEmpty();
        } else if (Buffer.isBuffer(output)) {
          return this.serializeBuffer(output);
        } else if (this.isStream(output)) {
          return this.serializeStream(output);
        } else if (output instanceof Error) {
          return this.serializeError(output);
        } else if (output instanceof Blob) {
          return this.serializeBlob(output);
        } else {
          return this.serializeJSON(output);
        }
      }
    }
  }
}