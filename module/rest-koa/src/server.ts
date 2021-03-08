import type * as https from 'https';
import * as koa from 'koa';
import * as kCompress from 'koa-compress';
import * as kBodyParser from 'koa-bodyparser';
import * as kRouter from 'koa-router';

import { Injectable, Inject } from '@travetto/di';
import { RestConfig, RestServer, RouteConfig, RestCookieConfig } from '@travetto/rest';
import { TravettoEntitySym } from '@travetto/rest/src/internal/symbol';
import { Request, Response } from '@travetto/rest/src/types';

import { KoaServerUtil } from './internal/util';

type TrvCtx = { [TravettoEntitySym]: [Request, Response] };
type Router = kRouter<{}, TrvCtx>;
type Routes = ReturnType<Router['routes']>;

/**
 * Koa-based Rest server
 */
@Injectable()
export class KoaRestServer implements RestServer<koa> {

  raw: koa;

  listening = false;

  reregisterGlobalOnChange = true;

  @Inject()
  cookies: RestCookieConfig;

  @Inject()
  config: RestConfig;

  init(): koa {
    const app = new koa();
    app.use(kCompress());
    app.use(kBodyParser());

    app.keys = this.cookies.keys;

    // Enable proxy for cookies
    if (this.config.trustProxy) {
      app.proxy = true;
    }

    this.raw = app;

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
    const router = new kRouter<unknown, TrvCtx>(path !== '/' ? { prefix: path } : {});

    // Register all routes to extract the proper request/response for the framework
    for (const route of routes) {
      if (route.path === '*') { // Wildcard is no longer supported directly
        route.path = /.*/;
      }
      router[route.method as 'get'](route.path!, async (ctx) => {
        const [req, res] = ctx[TravettoEntitySym] ??= [
          KoaServerUtil.getRequest(ctx),
          KoaServerUtil.getResponse(ctx)
        ];
        return await route.handlerFinalized!(req, res);
      });
    }

    // Register routes
    const middleware: Routes & { key?: string | symbol } = router.routes();
    middleware.key = key;
    this.raw.use(middleware);
  }

  async listen() {
    let raw: https.Server | koa = this.raw;
    if (this.config.ssl.active) {
      raw = (await import('https'))
        .createServer((await this.config.getKeys())!, this.raw.callback())
        .listen(this.config.port, this.config.bindAddress);
    }
    this.listening = true;
    return raw.listen(this.config.port, this.config.bindAddress);
  }
}