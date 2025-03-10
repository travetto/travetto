import { Readable } from 'node:stream';

import { AppError, BinaryUtil, ErrorCategory, hasFunction, hasToJSON } from '@travetto/runtime';
import { DataUtil } from '@travetto/schema';

import { HttpSerializable } from '../response/serializable';
import { HttpResponse } from '../types';
import { WebSymbols } from '../symbols';

type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

export type SerializedResult = {
  headers?: Record<string, string>;
  defaultContentType?: string;
  statusCode?: number;
  data: Readable | Buffer | string;
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
  static fromJSON(output: unknown): SerializedResult {
    const val = hasToJSON(output) ? output.toJSON() : output;
    const data = JSON.stringify(val);
    return { defaultContentType: 'application/json', data, length: data.length };
  }

  /**
   * Serialize file/blob
   */
  static fromBlob(output: Blob | File): SerializedResult {
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
      out.length = output.size;
      out.headers!['content-length'] = `${output.size}`;
    }

    return out;
  }

  /**
   * Create error from an unknown source
   */
  static toError(error: unknown): ErrorResponse {
    return error instanceof Error ? error :
      !DataUtil.isPlainObject(error) ? new AppError(`${error}`) :
        new AppError(`${error['message'] || 'Unexpected error'}`, { details: error });
  }

  /**
   * Serialize Error
   */
  static fromError(error: ErrorResponse): SerializedResult {
    const output = this.fromJSON(hasToJSON(error) ? error.toJSON() : { message: error.message });
    return {
      ...output,
      headers: { ...output.headers, 'content-type': output.defaultContentType! },
      statusCode: error.status ?? error.statusCode ?? CATEGORY_STATUS[error.category!] ?? 500,
    };
  }

  /**
   * Serialize renderable
   */
  static async fromRenderable(res: HttpResponse, output: HttpSerializable): Promise<SerializedResult | undefined> {
    this.setHeaders(res, res[WebSymbols.Internal].headersAdded);
    const result = await output.serialize(res);
    return result ? this.serialize(result) : undefined;
  }

  /**
   * Determine serialization type based on output
   */
  static serialize(output: unknown): SerializedResult | undefined {
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
   * Send result to response
   */
  static async sendResult(response: HttpResponse, result?: SerializedResult): Promise<void> {
    if (!result) { // Nothing to do
      return;
    } else if (response.headersSent) { // Already sent, do nothing
      return console.error('Failed to send, already sent data');
    }

    // Set implicit headers
    this.setHeaders(response, response[WebSymbols.Internal].headersAdded);
    this.setHeaders(response, result?.headers);

    // Set header if not defined
    if (result?.defaultContentType && !response.getHeader('content-type')) {
      response.setHeader('content-type', result.defaultContentType);
    }

    response.statusCode = result.statusCode ?? response.statusCode ?? 200;

    if (!result.data) {
      response.send('');
    } else if (Buffer.isBuffer(result.data) || typeof result.data === 'string') {
      response.send(result);
    } else {
      await response.sendStream(result.data);
    }
  }
}