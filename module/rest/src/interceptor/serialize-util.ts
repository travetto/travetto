import { Readable } from 'stream';

import { StreamUtil, ErrorCategory, AppError, Util } from '@travetto/base';

import { SendStreamⲐ, NodeEntityⲐ, HeadersAddedⲐ } from '../internal/symbol';
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
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  static isRenderable = (o: unknown): o is Renderable => !!o && !Util.isPrimitive(o) && 'render' in (o as object);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  static isStream = (o: unknown): o is Readable => !!o && 'pipe' in (o as object) && 'on' in (o as object);

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
    const payload = Util.hasToJSON(output) ? output.toJSON() : output;
    this.setContentTypeIfUndefined(res, 'application/json');
    res.send(JSON.stringify(payload, undefined, 'pretty' in req.query ? 2 : 0));
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
    return (res[SendStreamⲐ] ? res[SendStreamⲐ](output) : StreamUtil.pipe(output, res[NodeEntityⲐ]));
  }

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
    res.send(JSON.stringify(error.toJSON({ status })));
  }

  /**
   * Determine serialization type based on output
   */
  static serializeStandard(req: Request, res: Response, output: unknown): void | Promise<void> {
    this.setHeaders(res, res[HeadersAddedⲐ]);

    if (!output) {
      return this.serializeEmpty(req, res);
    } else if (typeof output === 'string') {
      return this.serializeText(res, output);
    } else if (Buffer.isBuffer(output)) {
      return this.serializeBuffer(res, output);
    } else if (this.isStream(output)) {
      return this.serializeStream(res, output);
    } else if (output instanceof Error) {
      return this.serializeError(res, output);
    } else {
      return this.serializeJSON(req, res, output);
    }
  }
}