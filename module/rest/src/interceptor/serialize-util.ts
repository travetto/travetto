import { Readable } from 'stream';

import { AppError, Util } from '@travetto/base';
import { ErrorUtil } from '@travetto/base/src/internal/error';
import { StreamUtil } from '@travetto/boot';

import { HeadersAddedⲐ, SendStreamⲐ, NodeEntityⲐ } from '../internal/symbol';
import { Renderable } from '../response/renderable';
import { FilterContext, Response } from '../types';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const isRenderable = (o: unknown): o is Renderable => !!o && !Util.isPrimitive(o) && 'render' in (o as object);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const isStream = (o: unknown): o is Readable => !!o && 'pipe' in (o as object) && 'on' in (o as object);

/**
 * Utilities for serializing output
 */
export class SerializeUtil {

  /**
   * Determine the error status for a given error, with special provisions for AppError
   */
  static getErrorStatus(err: Error & { status?: number, statusCode?: number }): number {
    return err.status ??
      err.statusCode ??
      (err instanceof AppError ? ErrorUtil.codeFromCategory(err.category) : 500);
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
   * Send output to the response
   * @param output The value to output
   */
  static async sendOutput({ req, res }: FilterContext, output: unknown): Promise<void> {
    if (res.headersSent) {
      return;
    } else if (res[HeadersAddedⲐ]) {
      for (const [k, v] of Object.entries(res[HeadersAddedⲐ]!)) {
        res.setHeader(k, typeof v === 'string' ? v : v());
      }
    }

    if (!output) {
      res.status(req.method === 'POST' || req.method === 'PUT' ? 201 : 204);
      res.send('');
      return;
    }

    if (isRenderable(output)) {
      output = await output.render(res);
      if (output === undefined) { // If render didn't return a result, consider us done
        return;
      }
    }

    if (typeof output === 'string') {
      this.setContentTypeIfUndefined(res, 'text/plain');
      res.send(output);
    } else if (Buffer.isBuffer(output)) {
      this.setContentTypeIfUndefined(res, 'application/octet-stream');
      res.send(output);
    } else if (isStream(output)) {
      this.setContentTypeIfUndefined(res, 'application/octet-stream');
      await (res[SendStreamⲐ] ? res[SendStreamⲐ](output) : StreamUtil.pipe(output, res[NodeEntityⲐ]));
    } else if (output instanceof Error) {
      const status = this.getErrorStatus(output);
      res.status(status);
      res.statusError = output;
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(output.toJSON({ status })));
    } else {
      const payload = Util.hasToJSON(output) ? output.toJSON() : output;
      this.setContentTypeIfUndefined(res, 'application/json');
      res.send(JSON.stringify(payload, undefined, 'pretty' in req.query ? 2 : 0));
    }
  }
}