import https from 'node:https';
import express from 'express';
import compression from 'compression';

import { Inject, Injectable } from '@travetto/di';
import {
  WebSymbols, HttpInterceptor, WebConfig, EndpointUtil, WebServer,
  LoggingInterceptor, WebServerHandle, EndpointConfig
} from '@travetto/web';
import { castTo, Util } from '@travetto/runtime';

import { ExpressWebServerUtil } from './util.ts';

type Keyed = { key?: string | symbol };

/**
 * An express http server
 */
@Injectable()
export class ExpressWebServer implements WebServer<express.Application> {

  raw: express.Application;

  listening: boolean;

  updateGlobalOnChange = true;

  @Inject()
  config: WebConfig;

  async init(): Promise<express.Application> {
    const app = express();
    app.disable('x-powered-by');
    app.set('etag', this.config.etag);
    app.use(compression());

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

  async registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[], interceptors: HttpInterceptor[]): Promise<void> {
    const router: express.Router & Keyed = express.Router({ mergeParams: true });

    for (const endpoint of endpoints) {
      const endpointPath = endpoint.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');
      router[endpoint.method](endpointPath, async (req, res) => {
        await endpoint.handlerFinalized!(...ExpressWebServerUtil.convert(req, res));
      });
    }

    // Register options handler for each controller, working with a bug in express
    if (key !== WebSymbols.GlobalEndpoint) {
      const optionHandler = EndpointUtil.createEndpointHandler(
        interceptors,
        {
          method: 'options',
          path: '*all',
          id: 'express-all',
          filters: [],
          headers: {},
          handlerName: 'express-all',
          class: ExpressWebServer,
          handler: () => '',
          params: [],
          interceptors: [
            [LoggingInterceptor, { disabled: true }]
          ]
        }
      );

      router.options('*all', (req, res) => {
        optionHandler(...ExpressWebServerUtil.convert(req, res));
      });
    }

    router.key = key;
    this.raw.use(path, router);
  }

  async listen(): Promise<WebServerHandle> {
    let raw: express.Application | https.Server = this.raw;
    if (this.config.ssl?.active) {
      raw = https.createServer((await this.config.ssl?.getKeys())!, this.raw);
    }
    this.listening = true;

    const { reject, resolve, promise } = Util.resolvablePromise<WebServerHandle>();
    const handle = raw.listen(this.config.port, this.config.hostname, err => err ? reject(err) : resolve(handle));
    return promise;
  }
}