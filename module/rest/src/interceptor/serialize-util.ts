import { Readable } from 'node:stream';

import { ErrorCategory, AppError, BinaryUtil, hasFunction } from '@travetto/runtime';

import { HeadersAddedⲐ } from '../internal/symbol';
import { Renderable } from '../response/renderable';
import { Request, Response } from '../types';

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
   * Determine the error status for a given error, with special provisions for AppError
   */
  static getErrorStatus(err: Error & { status?: number, statusCode?: number }): number {
    return err.status ??
      err.statusCode ??
      (err instanceof AppError ? categoryToCode[err.category] : 500);
  }

  /**
   * Set outbound content type if not defined
   * @param res Response
   * @param type mime type
   */
  static setContentTypeIfUndefined(res: Response, type: string): void {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', type);
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
  static serializeJSON(req: Request, res: Response, output: unknown): void {
    let val = output;
    if (typeof val === 'object' && !!val && 'toJSON' in val && typeof val.toJSON === 'function') {
      val = val.toJSON();
    }
    this.setContentTypeIfUndefined(res, 'application/json');
    res.send(JSON.stringify(val, undefined, '__pretty' in req.query ? 2 : 0));
  }

  /**
   * Primitive json
   */
  static serializePrimitive(res: Response, output: unknown): void {
    this.setContentTypeIfUndefined(res, 'application/json');
    res.send(JSON.stringify(output));
  }

  /**
   * Serialize text
   */
  static serializeText(res: Response, output: string): void {
    this.setContentTypeIfUndefined(res, 'text/plain');
    res.send(output);
  }

  /**
   * Serialize buffer
   */
  static serializeBuffer(res: Response, output: Buffer): void {
    this.setContentTypeIfUndefined(res, 'application/octet-stream');
    res.send(output);
  }

  /**
   * Serialize stream
   */
  static async serializeStream(res: Response, output: Readable): Promise<void> {
    this.setContentTypeIfUndefined(res, 'application/octet-stream');
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
      this.setContentTypeIfUndefined(res, output.type);
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
  static serializeError(res: Response, error: Error): void {
    const status = this.getErrorStatus(error);
    res.status(status);
    res.statusError = error;
    res.setHeader('Content-Type', 'application/json');
    const out = error instanceof AppError ? error.toJSON() : { message: error.message };
    res.send(JSON.stringify({ ...out, status }));
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
          return this.serializeError(res, output);
        } else if (output instanceof Blob) {
          return this.serializeBlob(res, output);
        } else {
          return this.serializeJSON(req, res, output);
        }
      }
    }
  }
}