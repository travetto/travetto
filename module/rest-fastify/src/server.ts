import { IncomingMessage } from 'http';
import * as fastify from 'fastify';

import { AppUtil } from '@travetto/app';
import { RouteConfig, RestServer } from '@travetto/rest';
import { Injectable } from '@travetto/di';

import { FastifyServerUtil } from './internal/util';

/**
 * Fastify-based rest server
 */
@Injectable()
export class FastifyRestServer extends RestServer<fastify.FastifyInstance> {

  /**
   * Build the fastify server
   */
  async createRaw() {
    const fastConf: any = {};
    if (this.config.ssl.active) {
      fastConf.https = await this.config.getKeys();
    }
    if (this.config.trustProxy) {
      fastConf.trustProxy = true;
    }

    const app = fastify(fastConf);
    app.register(require('fastify-compress'));
    app.register(require('fastify-formbody'));
    app.addContentTypeParser('multipart/form-data;', (req: IncomingMessage, done: (err: Error | null, body?: any) => void) => {
      done(null);
    });

    return app;
  }

  /**
   * Fastify does not support live reload, this will just log at runtime
   */
  async unregisterRoutes(key: string | symbol) {
    console.debug('Fastify does not allow for route reloading');
  }

  /**
   * Register routes, does not support live reload
   */
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
      ...AppUtil.listenToCloseable(this.raw.server),
      kill: this.raw.close.bind(this.raw)
    };
  }
}