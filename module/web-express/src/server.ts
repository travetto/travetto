import https from 'node:https';
import express from 'express';
import compression from 'compression';

import { Inject, Injectable } from '@travetto/di';
import {
  WebSymbols, HttpInterceptor, WebConfig, EndpointUtil, WebServer,
  LoggingInterceptor, NetUtil, WebServerHandle, EndpointConfig
} from '@travetto/web';

import { ExpressWebServerUtil } from './util';

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
    app.set('query parser', 'simple');
    app.disable('x-powered-by');
    app.use(compression());

    if (this.config.trustProxy) {
      app.enable('trust proxy');
    }

    this.raw = app;

    return app;
  }

  async unregisterEndpoints(key: string | symbol): Promise<void> {
    const layers = this.raw.router.stack;
    const pos = layers.findIndex(x => 'key' in x.handle && x.handle.key === key);
    if (pos >= 0) {
      layers.splice(pos, 1);
    }
  }

  async registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[], interceptors: HttpInterceptor[]): Promise<void> {
    const router: express.Router & { key?: string | symbol } = express.Router({ mergeParams: true });

    for (const endpoint of endpoints) {
      const endpointPath = endpoint.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');
      router[endpoint.method](endpointPath, async (req: express.Request, res: express.Response) => {
        await endpoint.handlerFinalized!(
          req[WebSymbols.TravettoEntity] ??= ExpressWebServerUtil.getRequest(req),
          res[WebSymbols.TravettoEntity] ??= ExpressWebServerUtil.getResponse(res)
        );
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

      router.options('*all', (req: express.Request, res: express.Response) => {
        optionHandler(
          req[WebSymbols.TravettoEntity] ??= ExpressWebServerUtil.getRequest(req),
          res[WebSymbols.TravettoEntity] ??= ExpressWebServerUtil.getResponse(res)
        );
      });
    }

    router.key = key;
    this.raw.use(path, router);
  }

  async listen(): Promise<WebServerHandle> {
    let raw: express.Application | https.Server = this.raw;
    if (this.config.ssl?.active) {
      const keys = await this.config.ssl?.getKeys();
      raw = https.createServer(keys!, this.raw);
    }
    this.listening = true;
    return await NetUtil.listen(raw, this.config.port, this.config.bindAddress);
  }
}