import https from 'node:https';

import express from 'express';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, WebRouter } from '@travetto/web';
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

  registerRouter(router: WebRouter): void {
    this.raw.use(async (req, res, next) => {
      const { endpoint, params } = router({ method: castTo((req.method).toUpperCase()), url: req.url, headers: req.headers });
      await endpoint.filter!({ req: ExpressWebServerUtil.getRequest(req, res, params) });
      next();
    });
  }

  async listen(): Promise<WebServerHandle> {
    let raw: express.Application | https.Server = this.raw;
    if (this.config.ssl?.active) {
      raw = https.createServer((await this.config.ssl?.getKeys())!, this.raw);
    }
    const { reject, resolve, promise } = Promise.withResolvers<void>();
    const server = raw.listen(this.config.port, this.config.hostname, err => err ? reject(err) : resolve());
    await promise;
    return {
      port: this.config.port,
      close: server.close.bind(server),
      on: server.on.bind(server)
    };
  }
}