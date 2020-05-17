import * as koa from 'koa';
import * as kCompress from 'koa-compress';
import * as kBodyParser from 'koa-bodyparser';
import * as kRouter from 'koa-router';

import { AppUtil } from '@travetto/app';
import { Injectable, Inject } from '@travetto/di';
import { RestServer, RouteConfig, RestCookieConfig } from '@travetto/rest';

import { KoaServerUtil } from './internal/util';
import Router = require('koa-router');

/**
 * Koa-based Rest server
 */
@Injectable()
export class KoaRestServer extends RestServer<koa> {

  @Inject()
  cookies: RestCookieConfig;

  createRaw(): koa {
    const app = new koa();
    app.use(kCompress());
    app.use(kBodyParser());

    app.keys = this.cookies.keys;

    // Enable proxy for cookies
    if (this.config.trustProxy) {
      app.proxy = true;
    }

    return app;
  }

  /**
   * Use during development to remove routes
   */
  async unregisterRoutes(key: string | symbol) {
    // Delete previous
    const pos = this.raw.middleware.findIndex(x => (x as { key?: symbol | string }).key === key);
    if (pos >= 0) {
      this.raw.middleware.splice(pos, 1);
    }
  }

  /**
   * Register routes, is used during development for live-reloading as well
   */
  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]) {
    const router = new kRouter(path !== '/' ? { prefix: path } : {});

    // Register all routes to extract the proper request/response for the framework
    for (const route of routes) {
      router[route.method!](route.path!, async (ctx) => {
        const req = KoaServerUtil.getRequest(ctx);
        const res = KoaServerUtil.getResponse(ctx);
        return await route.handlerFinalized!(req, res);
      });
    }

    // Register routes
    const middleware: ReturnType<Router['routes']> & { key?: string | symbol } = router.routes();
    middleware.key = key;
    this.raw.use(middleware);

    // If already running and not global routes, re-register
    if (this.listening && key !== RestServer.GLOBAL) {
      await this.unregisterGlobal();
      await this.registerGlobal();
    }
  }

  async listen() {
    let server;
    if (this.config.ssl.active) {
      const https = await import('https');
      server = https.createServer((await this.config.getKeys())!, this.raw.callback()).listen(this.config.port, this.config.bindAddress);
    } else {
      server = this.raw.listen(this.config.port, this.config.bindAddress);
    }
    return AppUtil.listenToCloseable(server);
  }
}