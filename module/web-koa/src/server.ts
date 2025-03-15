import https from 'node:https';
import koa from 'koa';
import kCompress from 'koa-compress';
import kEtag from 'koa-etag';
import kRouter from 'koa-router';

import { Injectable, Inject } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, EndpointConfig } from '@travetto/web';
import { castTo, Util } from '@travetto/runtime';

import { KoaWebServerUtil } from './util.ts';

type Keyed = { key?: string | symbol };

/**
 * Koa-based Web server
 */
@Injectable()
export class KoaWebServer implements WebServer<koa> {

  raw: koa;

  listening = false;

  updateGlobalOnChange = true;

  @Inject()
  config: WebConfig;

  async init(): Promise<koa> {
    const app = new koa();
    app.use(kCompress());
    app.use(kEtag());

    if (this.config.trustProxy) {
      app.proxy = true;
    }

    return this.raw = app;
  }

  async unregisterEndpoints(key: string | symbol): Promise<void> {
    // Delete previous
    const pos = this.raw.middleware.findIndex(x => castTo<Keyed>(x).key === key);
    if (pos >= 0) {
      this.raw.middleware.splice(pos, 1);
    }
  }

  async registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[]): Promise<void> {
    const router = new kRouter<unknown, koa.Context>(path !== '/' ? { prefix: path } : {});

    // Register all endpoints to extract the proper request/response for the framework
    for (const endpoint of endpoints) {
      const finalPath = endpoint.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');
      router[endpoint.method](finalPath, ctx => endpoint.handlerFinalized!(...KoaWebServerUtil.convert(ctx)));
    }

    // Register endpoints
    const middleware = router.routes();
    castTo<Keyed>(middleware).key = key;
    this.raw.use(middleware);
  }

  async listen(): Promise<WebServerHandle> {
    let raw: https.Server | koa = this.raw;
    if (this.config.ssl?.active) {
      raw = https.createServer((await this.config.ssl?.getKeys())!, this.raw.callback());
    }
    this.listening = true;

    const { reject, resolve, promise } = Util.resolvablePromise<WebServerHandle>();
    const handle = raw.listen(this.config.port, this.config.bindAddress)
      .on('error', reject)
      .on('listening', () => resolve(handle));
    return promise;
  }
}