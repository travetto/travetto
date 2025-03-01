import https from 'node:https';
import koa from 'koa';
import kCompress from 'koa-compress';
import kRouter from 'koa-router';

import { Injectable, Inject } from '@travetto/di';
import { WebConfig, WebServer, CookieConfig, NetUtil, WebServerHandle, WebSymbols, EndpointConfig } from '@travetto/web';

import { KoaWebServerUtil } from './util';

/**
 * Koa-based Web server
 */
@Injectable()
export class KoaWebServer implements WebServer<koa> {

  raw: koa;

  listening = false;

  updateGlobalOnChange = true;

  @Inject()
  cookies: CookieConfig;

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

  async unregisterEndpoints(key: string | symbol): Promise<void> {
    // Delete previous
    const pos = this.raw.middleware.findIndex(x => {
      const _x: (typeof x) & { key?: string } = x;
      return _x.key === key;
    });
    if (pos >= 0) {
      this.raw.middleware.splice(pos, 1);
    }
  }

  async registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[]): Promise<void> {
    const router = new kRouter<unknown, koa.Context>(path !== '/' ? { prefix: path } : {});

    // Register all endpoints to extract the proper request/response for the framework
    for (const endpoint of endpoints) {
      const finalPath = endpoint.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');
      router[endpoint.method](finalPath, async (ctx) => {
        const [req, res] = ctx[WebSymbols.TravettoEntity] ??= [
          KoaWebServerUtil.getRequest(ctx),
          KoaWebServerUtil.getResponse(ctx)
        ];
        return await endpoint.handlerFinalized!(req, res);
      });
    }

    // Register endpoints
    const middleware: ReturnType<kRouter<unknown, koa.Context>['routes']> & { key?: symbol | string } = router.routes();
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
    return await NetUtil.listen(raw, this.config.port, this.config.bindAddress!);
  }
}