import { FastifyPluginAsync } from 'fastify';

import { Injectable } from '@travetto/di';
import { FastifyRestServer } from '@travetto/rest-fastify';

declare let rateLimit: (config: { windowMs: number, max: number }) => FastifyPluginAsync;

@Injectable({ primary: true })
class CustomRestServer extends FastifyRestServer {
  override async init() {
    const app = await super.init();
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });

    //  apply to all requests
    app.register(limiter);

    return app;
  }
}