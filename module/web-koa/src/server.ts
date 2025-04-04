import https from 'node:https';
import koa from 'koa';

import { Injectable, Inject } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, WebRouter } from '@travetto/web';
import { castTo } from '@travetto/runtime';

import { KoaWebServerUtil } from './util.ts';

type Keyed = { key?: string | symbol };

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

  registerRouter(router: WebRouter): void {
    this.raw.use(async (ctx) => {
      const { endpoint, params } = router({ method: castTo((ctx.method).toUpperCase()), url: ctx.url, headers: ctx.headers });
      ctx.params = params;
      return endpoint.filter!({ req: KoaWebServerUtil.getRequest(ctx) });
    });
  }

  async listen(): Promise<WebServerHandle> {
    let raw: https.Server | koa = this.raw;
    if (this.config.ssl?.active) {
      raw = https.createServer((await this.config.ssl?.getKeys())!, this.raw.callback());
    }
    const { reject, resolve, promise } = Promise.withResolvers<void>();
    const server = raw.listen(this.config.port, this.config.bindAddress)
      .on('error', reject)
      .on('listening', resolve);
    await promise;
    server.off('error', reject);

    return {
      port: this.config.port,
      close: server.close.bind(server),
      on: server.on.bind(server)
    };
  }
}