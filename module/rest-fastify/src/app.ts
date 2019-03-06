import { IncomingMessage } from 'http';
import * as fastify from 'fastify';

import { RouteConfig, RestApp } from '@travetto/rest';
import { Inject } from '@travetto/di';

import { FastifyConfig } from './config';
import { FastifyAppUtil } from './util';

export class FastifyRestApp extends RestApp<fastify.FastifyInstance> {

  @Inject()
  private fastifyConfig: FastifyConfig;

  async createRaw() {
    const fastConf: any = {};
    if (this.config.ssl) {
      fastConf.https = await this.config.getKeys();
    }

    const app = fastify(fastConf);
    app.register(require('fastify-compress'));
    app.register(require('fastify-formbody'));
    app.register(require('fastify-cookie'));
    app.addContentTypeParser('multipart/form-data;', (req: IncomingMessage, done: (err: Error | null, body?: any) => void) => {
      done(null);
    });

    return app;
  }

  async unregisterRoutes(key: string | symbol) {
    console.log('Fastify does not allow for route reloading');
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]) {
    if (this.listening) {
      return;
    }
    for (const route of routes) {
      if (typeof route.path === 'string') {
        path = `${path}/${route.path}`;
      } else {
        path = `${path}/${route.path.source}`;
      }
      path = path.replace(/\/+/g, '/').replace(/\/+$/, '');
      this.raw[route.method!](path, async (reqs, reply) => {
        const req = FastifyAppUtil.getRequest(reqs);
        const res = FastifyAppUtil.getResponse(reply);
        await route.handlerFinalized!(req, res);
      });
    }
  }

  listen() {
    this.raw.listen(this.config.port);
  }
}