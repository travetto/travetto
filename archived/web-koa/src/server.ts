import koa from 'koa';

import { Injectable, Inject } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, WebDispatcher, NetUtil } from '@travetto/web';

import { KoaWebServerUtil } from './util.ts';

/**
 * Koa-based Web server
 */
@Injectable()
export class KoaWebServer implements WebServer<koa> {

  raw: koa;

  @Inject()
  config: WebConfig;

  async init(): Promise<koa> {
    const app = new koa();

    if (this.config.trustProxy) {
      app.proxy = true;
    }

    return this.raw = app;
  }

  registerRouter(router: WebDispatcher): void {
    this.raw.use(async (ctx) => {
      const { endpoint, params } = router(ctx);
      ctx.params = params;
      return endpoint.filter!({ req: KoaWebServerUtil.getRequest(ctx) });
    });
  }

  async listen(): Promise<WebServerHandle> {
    return NetUtil.createHttpServer({
      bindAddress: this.config.bindAddress,
      port: this.config.port,
      handler: this.raw.callback(),
      sslKeys: await (this.config.ssl?.active ? this.config.ssl.getKeys() : undefined),
    });
  }
}