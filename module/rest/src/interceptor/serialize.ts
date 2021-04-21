import { Readable } from 'stream';

import { AppError, Util } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { RestInterceptor } from './types';
import { LoggingInterceptor } from './logging';

import { Response, Request } from '../types';
import { Renderable } from '../response/renderable';
import { HeadersAddedSym, NodeEntitySym } from '../internal/symbol';

const isRenderable = (o: unknown): o is Renderable => !!o && !Util.isPrimitive(o) && 'render' in (o as object);
const isStream = (o: unknown): o is Readable => !!o && 'pipe' in (o as object) && 'on' in (o as object);

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
  static setContentTypeIfUndefined(res: Response, type: string) {
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
  static async sendOutput(req: Request, res: Response, output: unknown) {
    if (!res.headersSent) {
      if (output) {
        if (res[HeadersAddedSym]) {
          for (const [k, v] of Object.entries(res[HeadersAddedSym]!)) {
            res.setHeader(k, typeof v === 'string' ? v : v());
          }
        }
        if (isRenderable(output)) {
          await output.render(res);
        } else if (typeof output === 'string') {
          this.setContentTypeIfUndefined(res, 'text/plain');
          res.send(output);
        } else if (Buffer.isBuffer(output)) {
          this.setContentTypeIfUndefined(res, 'application/octet-stream');
          res.send(output);
        } else if (isStream(output)) {
          this.setContentTypeIfUndefined(res, 'application/octet-stream');
          output.pipe(res[NodeEntitySym]);
        } else {
          const payload = Util.hasToJSON(output) ? output.toJSON() : output;
          this.setContentTypeIfUndefined(res, 'application/json');
          res.send(JSON.stringify(payload, undefined, 'pretty' in req.query ? 2 : 0));
        }
      } else {
        res.status(201);
        res.send('');
      }
    }
  }

  after = [LoggingInterceptor];

  async intercept(req: Request, res: Response, next: () => Promise<void | unknown>) {
    try {
      const output = await next();
      await SerializeInterceptor.sendOutput(req, res, output);
    } catch (error) {
      if (!(error instanceof Error)) {  // Ensure we always throw "Errors"
        error = new AppError(error.message || 'Unexpected error', 'general', error);
      }
      await SerializeInterceptor.sendOutput(req, res, error);
    }
  }
}