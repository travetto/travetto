import { Middleware } from 'koa';

import { Injectable } from '@travetto/di';
import { KoaRestServer } from '@travetto/rest-koa';
import { TimeUtil } from '@travetto/base';

declare let rateLimit: (config: { windowMs: number, max: number }) => Middleware;

@Injectable({ primary: true })
class CustomRestServer extends KoaRestServer {
  override async init() {
    const app = await super.init();
    const limiter = rateLimit({
      windowMs: TimeUtil.asMillis(15, 'm'), // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });

    //  apply to all requests
    app.use(limiter);

    return app;
  }
}