import { Injectable } from '@travetto/di';
import { FastifyRestServer } from '@travetto/rest-fastify';
import { FastifyPluginAsync } from 'fastify';

declare let rateLimit: (config: { windowMs: number, max: number }) => FastifyPluginAsync;

@Injectable({ primary: true })
class CustomRestServer extends FastifyRestServer {
  async createRaw() {
    const app = await super.createRaw();
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });

    //  apply to all requests
    app.register(limiter);

    return app;
  }
}