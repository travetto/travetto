import { Readable } from 'stream';

import { AppError, Util } from '@travetto/base';
import { StreamUtil } from '@travetto/boot';
import { Injectable } from '@travetto/di';

import { RestInterceptor } from './types';
import { LoggingInterceptor } from './logging';

import { Response, Request } from '../types';
import { Renderable } from '../response/renderable';
import { HeadersAddedⲐ, NodeEntityⲐ, SendStreamⲐ } from '../internal/symbol';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const isRenderable = (o: unknown): o is Renderable => !!o && !Util.isPrimitive(o) && 'render' in (o as object);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const isStream = (o: unknown): o is Readable => !!o && 'pipe' in (o as object) && 'on' in (o as object);

const isUnknownError = (o: unknown): o is Record<string, unknown> & { message?: string } => !(o instanceof Error);

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements RestInterceptor {

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
   * @param req Inbound request
   * @param res Outbound response
   * @param output The value to output
   */
  static async sendOutput(req: Request, res: Response, output: unknown): Promise<void> {
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
    } else {
      const payload = Util.hasToJSON(output) ? output.toJSON() : output;
      this.setContentTypeIfUndefined(res, 'application/json');
      res.send(JSON.stringify(payload, undefined, 'pretty' in req.query ? 2 : 0));
    }
  }

  after = [LoggingInterceptor];

  async intercept(req: Request, res: Response, next: () => Promise<void | unknown>): Promise<void> {
    try {
      const output = await next();
      await SerializeInterceptor.sendOutput(req, res, output);
    } catch (err) {
      if (isUnknownError(err)) {  // Ensure we always throw "Errors"
        err = new AppError(err.message || 'Unexpected error', 'general', err);
      }
      await SerializeInterceptor.sendOutput(req, res, err);
    }
  }
}