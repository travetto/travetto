import express from 'express';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, WebDispatcher, NetUtil } from '@travetto/web';
import { castTo } from '@travetto/runtime';

import { ExpressWebServerUtil } from './util.ts';

/**
 * An express http server
 */
@Injectable()
export class ExpressWebServer implements WebServer<express.Application> {

  raw: express.Application;

  @Inject()
  config: WebConfig;

  async init(): Promise<express.Application> {
    const app = express();
    app.disable('x-powered-by');
    app.set('etag', false);

    if (this.config.trustProxy) {
      app.enable('trust proxy');
    }

    return this.raw = app;
  }

  registerRouter(router: WebDispatcher): void {
    this.raw.use(async (req, res, next) => {
      const { endpoint, params } = router(req);
      req.params = castTo(params);
      await endpoint.filter!({ req: ExpressWebServerUtil.getRequest(req, res) });
      next();
    });
  }

  async listen(): Promise<WebServerHandle> {
    return NetUtil.createHttpServer({
      bindAddress: this.config.bindAddress,
      port: this.config.port,
      handler: this.raw,
      sslKeys: await (this.config.ssl?.active ? this.config.ssl.getKeys() : undefined),
    });
  }
}