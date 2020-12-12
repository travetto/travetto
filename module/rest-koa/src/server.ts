import type * as https from 'https';
import * as koa from 'koa';
import * as kCompress from 'koa-compress';
import * as kBodyParser from 'koa-bodyparser';
import * as kRouter from 'koa-router';

import { Injectable, Inject } from '@travetto/di';
import { RestServer, RouteConfig, RestCookieConfig } from '@travetto/rest';
import { GlobalRoute } from '@travetto/rest/src/internal/types';

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

  async unregisterRoutes(key: string | symbol) {
    // Delete previous
    const pos = this.raw.middleware.findIndex(x => (x as { key?: symbol | string }).key === key);
    if (pos >= 0) {
      this.raw.middleware.splice(pos, 1);
    }
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]) {
    const router = new kRouter(path !== '/' ? { prefix: path } : {});

    // Register all routes to extract the proper request/response for the framework
    for (const route of routes) {
      if (route.path === '*') { // Wildcard is no longer supported directly
        route.path = /.*/;
      }
      router[route.method as 'get'](route.path!, async (ctx) => {
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
    if (this.listening && key !== GlobalRoute) {
      await this.unregisterGlobal();
      await this.registerGlobal();
    }
  }

  async listen() {
    let raw: https.Server | koa = this.raw;
    if (this.config.ssl.active) {
      raw = (await import('https'))
        .createServer((await this.config.getKeys())!, this.raw.callback())
        .listen(this.config.port, this.config.bindAddress);
    }
    return raw.listen(this.config.port, this.config.bindAddress);
  }
}