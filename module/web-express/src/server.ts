import https from 'node:https';

import express from 'express';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, EndpointConfig, HTTP_METHODS } from '@travetto/web';
import { castTo } from '@travetto/runtime';

import { ExpressWebServerUtil } from './util.ts';

type Keyed = { key?: string | symbol };

/**
 * An express http server
 */
@Injectable()
export class ExpressWebServer implements WebServer<express.Application> {

  raw: express.Application;

  listening: boolean;

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

  async unregisterEndpoints(key: string | symbol): Promise<void> {
    const layers = this.raw.router.stack;
    const pos = layers.findIndex(x => castTo<Keyed>(x.handle).key === key);
    if (pos >= 0) {
      layers.splice(pos, 1);
    }
  }

  async registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[]): Promise<void> {
    const router = express.Router({ mergeParams: true });
    castTo<Keyed>(router).key = key;

    for (const endpoint of endpoints) {
      const finalPath = endpoint.path === '/*all' ? '*all' :
        endpoint.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');

      router[HTTP_METHODS[endpoint.method].lower](finalPath, async (req, res, next) => {
        await endpoint.filter!({ req: ExpressWebServerUtil.getRequest(req, res) });
        next();
      });
    }

    this.raw.use(path, router);
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