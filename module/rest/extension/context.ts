import { Context } from '@travetto/context';
import { Injectable, Inject } from '@travetto/di';

import { RestInterceptor, Request, Response } from '../';

@Injectable()
export class ContextInterceptor extends RestInterceptor {

  @Inject()
  private context: Context;

  intercept(req: Request, res: Response) {
    return new Promise(proceed => {
      this.context.run(() => new Promise((resolve, reject) => {
        this.context.set({ req, res });
        req.on('close', resolve);
        req.on('end', resolve);
        req.on('error', reject);
        res.on('close', resolve);
        res.on('finish', resolve);
        proceed();
      }));
    });
  }
}
