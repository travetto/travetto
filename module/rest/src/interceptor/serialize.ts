import { AppError } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { RestInterceptor } from './interceptor';
import { LoggingInterceptor } from './logging';

import { MimeType } from '../util/mime';
import { Response, Request } from '../types';
import { isRenderable } from '../response/renderable';

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor extends RestInterceptor {

  /**
   * Set outbound content type if not defined
   * @param res Respponse
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
  static async sendOutput(req: Request, res: Response, output: any) {
    if (!res.headersSent) {
      if (output) {
        if (isRenderable(output)) {
          await output.render(res);
        } else if (typeof output === 'string') {
          this.setContentTypeIfUndefined(res, MimeType.TEXT);
          res.send(output);
        } else {
          const payload = ('toJSON' in output) ? output.toJSON() : output;
          this.setContentTypeIfUndefined(res, MimeType.JSON);
          res.send(JSON.stringify(payload, undefined, 'pretty' in req.query ? 2 : 0));
        }
      } else {
        res.status(201);
        res.send('');
      }
    }
  }

  after = [LoggingInterceptor];

  async intercept(req: Request, res: Response, next: (() => Promise<any>)): Promise<any> {
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