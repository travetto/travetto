import { FastifyPluginAsync } from 'fastify';

import { Injectable } from '@travetto/di';
import { FastifyWebServer } from '@travetto/web-fastify';
import { TimeUtil } from '@travetto/runtime';

declare let rateLimit: (config: { windowMs: number, max: number }) => FastifyPluginAsync;

@Injectable({ primary: true })
class CustomWebServer extends FastifyWebServer {
  override async init() {
    const app = await super.init();
    const limiter = rateLimit({
      windowMs: TimeUtil.asMillis(15, 'm'), // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });

    //  apply to all requests
    app.register(limiter);

    return app;
  }
}