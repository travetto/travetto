import https from 'node:https';
import koa from 'koa';
import kCompress from 'koa-compress';
import kRouter from 'koa-router';

import { Injectable, Inject } from '@travetto/di';
import { WebConfig, WebServer, RouteConfig, WebCookieConfig, WebNetUtil, WebServerHandle, WebSymbols } from '@travetto/web';

import { KoaWebServerUtil } from './util';

type Keyed = { key?: symbol | string };
type Routes = ReturnType<kRouter<unknown, koa.Context>['routes']>;

/**
 * Koa-based Web server
 */
@Injectable()
export class KoaWebServer implements WebServer<koa> {

  raw: koa;

  listening = false;

  updateGlobalOnChange = true;

  @Inject()
  cookies: WebCookieConfig;

  @Inject()
  config: WebConfig;

  async init(): Promise<koa> {
    const app = new koa();
    app.use(kCompress());

    app.keys = this.cookies.keys!;

    // Enable proxy for cookies
    if (this.config.trustProxy) {
      app.proxy = true;
    }

    this.raw = app;

    return app;
  }

  async unregisterRoutes(key: string | symbol): Promise<void> {
    // Delete previous
    const pos = this.raw.middleware.findIndex(x => {
      const _x: (typeof x) & { key?: string } = x;
      return _x.key === key;
    });
    if (pos >= 0) {
      this.raw.middleware.splice(pos, 1);
    }
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]): Promise<void> {
    const router = new kRouter<unknown, koa.Context>(path !== '/' ? { prefix: path } : {});

    // Register all routes to extract the proper request/response for the framework
    for (const route of routes) {
      const routePath = route.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');
      router[route.method](routePath, async (ctx) => {
        const [req, res] = ctx[WebSymbols.TravettoEntity] ??= [
          KoaWebServerUtil.getRequest(ctx),
          KoaWebServerUtil.getResponse(ctx)
        ];
        return await route.handlerFinalized!(req, res);
      });
    }

    // Register routes
    const middleware: Routes & Keyed = router.routes();
    middleware.key = key;
    this.raw.use(middleware);
  }

  async listen(): Promise<WebServerHandle> {
    let raw: https.Server | koa = this.raw;
    if (this.config.ssl?.active) {
      raw = https
        .createServer((await this.config.ssl?.getKeys())!, this.raw.callback());
    }
    this.listening = true;
    return await WebNetUtil.listen(raw, this.config.port, this.config.bindAddress!);
  }
}