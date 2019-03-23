import { IncomingMessage } from 'http';
import * as fastify from 'fastify';

import { RouteConfig, RestApp } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';

import { FastifyConfig } from './config';
import { FastifyAppUtil } from './util';

@Injectable()
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
    console.debug('Fastify does not allow for route reloading');
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]) {
    if (this.listening) {
      return;
    }
    for (const route of routes) {
      let sub = path;
      if (typeof route.path === 'string') {
        sub = `${path}/${route.path}`;
      } else {
        sub = `${path}/${route.path.source}`;
      }
      sub = sub.replace(/\/+/g, '/').replace(/\/+$/, '');
      this.raw[route.method!](sub, async (reqs, reply) => {
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