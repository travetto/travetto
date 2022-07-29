import * as https from 'https';
import compress from '@fastify/compress';
import formBody from '@fastify/formbody';

import { FastifyInstance, fastify, FastifyServerOptions, FastifyHttpsOptions } from 'fastify';

import { Request, Response, RestConfig, RouteConfig, RestServer } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';
import { TravettoEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { ServerHandle } from '@travetto/rest/src/types';

import { FastifyServerUtil } from './internal/util';

// Support typings
declare module 'fastify' {
  interface FastifyRequest {
    [TravettoEntityⲐ]?: Request;
  }
  interface FastifyReply {
    [TravettoEntityⲐ]?: Response;
  }
}

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
  async init(): Promise<FastifyInstance> {
    const fastConf: FastifyServerOptions = {};
    if (this.config.ssl.active) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (fastConf as FastifyHttpsOptions<https.Server>).https = (await this.config.getKeys())!;
    }
    if (this.config.trustProxy) {
      fastConf.trustProxy = true;
    }

    const app = fastify(fastConf);
    app.register(compress);
    app.register(formBody);

    // Allow everything else to be treated as a stream
    app.addContentTypeParser(['*'], (_r, _p, done) => done(null));

    this.raw = app;
    return app;
  }

  async unregisterRoutes(key: string | symbol): Promise<void> {
    console.debug('Fastify does not allow for route reloading');
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]): Promise<void> {
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
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this.raw[route.method as 'get'](sub, async (req, reply) => {
        await route.handlerFinalized!(
          req[TravettoEntityⲐ] ??= FastifyServerUtil.getRequest(req),
          reply[TravettoEntityⲐ] ??= FastifyServerUtil.getResponse(reply)
        );
      });
    }
  }

  async listen(): Promise<ServerHandle> {
    await this.raw.listen(this.config.port, this.config.bindAddress);
    this.listening = true;
    return {
      on: this.raw.server.on.bind(this.raw),
      close: this.raw.close.bind(this.raw)
    };
  }
}