import { Readable } from 'node:stream';

import { BinaryUtil, ErrorCategory, hasFunction, hasToJSON } from '@travetto/runtime';

import { HeadersAddedⲐ } from '../internal/symbol';
import { Renderable } from '../response/renderable';
import { Request, Response } from '../types';

type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

/**
 * Mapping from error category to standard http error codes
 */
const categoryToCode: Record<ErrorCategory, number> = {
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
   * Set outbound content type if not defined
   * @param res Response
   * @param type mime type
   */
  static ensureContentType(res: Response, defaultType: string, redefine = false): void {
    if (redefine || !res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', defaultType);
    }
  }

  /**
   * Set outbound headers
   */
  static setHeaders(res: Response, headers?: Record<string, string | (() => string)>): void {
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        res.setHeader(k, typeof v === 'string' ? v : v());
      }
    }
  }

  /**
   * Standard json
   */
  static serializeJSON(req: Request, res: Response, output: unknown, forceHeader = false): void {
    const val = hasToJSON(output) ? output.toJSON() : output;
    this.ensureContentType(res, 'application/json', forceHeader);
    res.send(JSON.stringify(val, undefined, '__pretty' in req.query ? 2 : 0));
  }

  /**
   * Primitive json
   */
  static serializePrimitive(res: Response, output: unknown): void {
    this.ensureContentType(res, 'application/json');
    res.send(JSON.stringify(output));
  }

  /**
   * Serialize text
   */
  static serializeText(res: Response, output: string): void {
    this.ensureContentType(res, 'text/plain');
    res.send(output);
  }

  /**
   * Serialize buffer
   */
  static serializeBuffer(res: Response, output: Buffer): void {
    this.ensureContentType(res, 'application/octet-stream');
    res.send(output);
  }

  /**
   * Serialize stream
   */
  static async serializeStream(res: Response, output: Readable): Promise<void> {
    this.ensureContentType(res, 'application/octet-stream');
    await res.sendStream(output);
  }

  /**
   * Serialize file/blob
   */
  static async serializeBlob(res: Response, output: Blob | File): Promise<void> {
    const meta = BinaryUtil.getBlobMeta(output);
    if (meta) {
      res.statusCode = meta?.range ? 206 : 200;
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
          res.setHeader(k, v);
        }
      }
    }

    if (output instanceof File && output.name) {
      // TODO: Attachment?
      res.setHeader('content-disposition', `attachment;filename="${output.name}"`);
    }
    if (output.type) {
      this.ensureContentType(res, output.type);
    }
    if (output.size) {
      res.setHeader('content-length', `${output.size}`);
    }

    return this.serializeStream(res, Readable.fromWeb(output.stream()));
  }

  /**
   * Send empty response
   */
  static serializeEmpty(req: Request, res: Response): void {
    res.status(req.method === 'POST' || req.method === 'PUT' ? 201 : 204);
    res.send('');
  }

  /**
   * Serialize Error
   * @param res
   * @param error
   */
  static serializeError(req: Request, res: Response, error: ErrorResponse): void {
    const status = error.status ?? error.statusCode ?? categoryToCode[error.category!] ?? 500;
    res.status(status);
    res.statusError = error;
    return this.serializeJSON(req, res, hasToJSON(error) ? error.toJSON() : { message: error.message }, true);
  }

  /**
   * Serialize renderable
   */
  static async serializeRenderable(req: Request, res: Response, output: Renderable): Promise<void> {
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
      return this.serializeStandard(req, res, result);
    }
  }

  /**
   * Determine serialization type based on output
   */
  static serializeStandard(req: Request, res: Response, output: unknown): void | Promise<void> {
    this.setHeaders(res, res[HeadersAddedⲐ]);
    switch (typeof output) {
      case 'undefined': return this.serializeEmpty(req, res);
      case 'string': return this.serializeText(res, output);
      case 'number':
      case 'boolean':
      case 'bigint': return this.serializePrimitive(res, output);
      case 'function':
      case 'object':
      default: {
        if (!output) {
          return this.serializeEmpty(req, res);
        } else if (Buffer.isBuffer(output)) {
          return this.serializeBuffer(res, output);
        } else if (this.isStream(output)) {
          return this.serializeStream(res, output);
        } else if (output instanceof Error) {
          return this.serializeError(req, res, output);
        } else if (output instanceof Blob) {
          return this.serializeBlob(res, output);
        } else if (this.isRenderable(output)) {
          return this.serializeRenderable(req, res, output);
        } else {
          return this.serializeJSON(req, res, output);
        }
      }
    }
  }
}