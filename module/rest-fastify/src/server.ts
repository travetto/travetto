import * as https from 'https';
import { FastifyInstance, fastify, FastifyServerOptions, FastifyHttpsOptions } from 'fastify';

import { RouteConfig, RestServer } from '@travetto/rest';
import { Injectable } from '@travetto/di';

import { FastifyServerUtil } from './internal/util';

/**
 * Fastify-based rest server
 */
@Injectable()
export class FastifyRestServer extends RestServer<FastifyInstance> {

  /**
   * Build the fastify server
   */
  async createRaw() {
    const fastConf: FastifyServerOptions = {};
    if (this.config.ssl.active) {
      (fastConf as FastifyHttpsOptions<https.Server>).https = (await this.config.getKeys())!;
    }
    if (this.config.trustProxy) {
      fastConf.trustProxy = true;
    }

    const app = fastify(fastConf);
    app.register(require('fastify-compress'));
    app.register(require('fastify-formbody'));
    app.addContentTypeParser('multipart/form-data;', (_r, _p, done) => done(null));

    return app;
  }

  async unregisterRoutes(key: string | symbol) {
    console.debug('Fastify does not allow for route reloading');
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]) {
    if (this.listening) { // Does not support live reload
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
      this.raw[route.method as 'get'](sub, async (reqs, reply) => {
        const req = FastifyServerUtil.getRequest(reqs);
        const res = FastifyServerUtil.getResponse(reply);
        await route.handlerFinalized!(req, res);
      });
    }
  }

  async listen() {
    await this.raw.listen(this.config.port, this.config.bindAddress);
    return {
      on: this.raw.server.on.bind(this.raw),
      close: this.raw.close.bind(this.raw)
    };
  }
}