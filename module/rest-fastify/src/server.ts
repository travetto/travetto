import * as https from 'https';
import { FastifyInstance, fastify, FastifyServerOptions, FastifyHttpsOptions } from 'fastify';

import { RestConfig, RouteConfig, RestServer } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';

import { FastifyServerUtil } from './internal/util';

/**
 * Fastify-based rest server
 */
@Injectable()
export class FastifyRestServer implements RestServer<FastifyInstance> {

  listening = false;

  raw: FastifyInstance;

  @Inject()
  config: RestConfig;

  /**
   * Build the fastify server
   */
  async init() {
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

    // Allow everything else to be treated as a stream
    // @ts-expect-error
    app.addContentTypeParser(['*'], (_r, _p, done) => done());

    this.raw = app;
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
    this.listening = true;
    return {
      on: this.raw.server.on.bind(this.raw),
      close: this.raw.close.bind(this.raw)
    };
  }
}