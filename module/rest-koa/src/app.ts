import * as koa from 'koa';
import * as kCompress from 'koa-compress';
import * as kBodyParser from 'koa-bodyparser';
import * as kRouter from 'koa-router';

import { Injectable, Inject } from '@travetto/di';
import { RestApp, RouteConfig, RestCookieConfig } from '@travetto/rest';

import { KoaAppUtil } from './util';

@Injectable()
export class KoaRestApp extends RestApp<koa> {

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
    const pos = this.raw.middleware.findIndex(x => (x as any).key === key);
    if (pos >= 0) {
      this.raw.middleware.splice(pos, 1);
    }
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]) {
    const router = new kRouter(path !== '/' ? { prefix: path } : {});

    for (const route of routes) {
      router[route.method!](route.path!, async (ctx) => {
        const req = KoaAppUtil.getRequest(ctx);
        const res = KoaAppUtil.getResponse(ctx);
        return await route.handlerFinalized!(req, res);
      });
    }

    const middleware = router.routes();
    (middleware as any).key = key;
    this.raw.use(middleware);

    if (this.listening && key !== RestApp.GLOBAL) {
      await this.unregisterGlobal();
      await this.registerGlobal();
    }
  }

  async listen() {
    if (this.config.ssl.active) {
      const https = await import('https');
      https.createServer((await this.config.getKeys())!, this.raw.callback()).listen(this.config.port, this.config.bindAddress);
    } else {
      this.raw.listen(this.config.port, this.config.bindAddress);
    }
  }
}