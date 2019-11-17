import { AppError } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { RestInterceptor } from './interceptor';
import { LoggingInterceptor } from './logging';

import { MimeType } from '../util/mime';
import { Response, Request } from '../types';
import { isRenderable } from '../response/renderable';

@Injectable()
export class SerializeInterceptor extends RestInterceptor {

  static setContentTypeIfUndefined(res: Response, type: string) {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', type);
    }
  }

  static async sendOutput(req: Request, res: Response, output: any) {
    if (!res.headersSent) {
      if (output) {
        if (isRenderable(output)) {
          await output.render(res);
        } else if (typeof output === 'string') {
          this.setContentTypeIfUndefined(res, MimeType.TEXT);
          res.send(output);
        } else if ('toJSON' in output) {
          this.setContentTypeIfUndefined(res, MimeType.JSON);
          res.send((output as any).toJSON());
        } else {
          this.setContentTypeIfUndefined(res, MimeType.JSON);
          res.send(JSON.stringify(output as any, undefined, 'pretty' in req.query ? 2 : 0));
        }
      } else {
        res.status(201);
        res.send('');
      }
    }
  }

  before = LoggingInterceptor;

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