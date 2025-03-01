import https from 'node:https';
import express from 'express';
import compression from 'compression';

import { Inject, Injectable } from '@travetto/di';
import { WebSymbols, HttpInterceptor, HttpRequest, WebConfig, RouteUtil, WebServer, RouteConfig, LoggingInterceptor, WebNetUtil, WebServerHandle } from '@travetto/web';

import { ExpressWebServerUtil } from './util';

/**
 * An express web server
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

  async unregisterRoutes(key: string | symbol): Promise<void> {
    const routes = this.raw.router.stack;
    const pos = routes.findIndex(x => 'key' in x.handle && x.handle.key === key);
    if (pos >= 0) {
      routes.splice(pos, 1);
    }
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[], interceptors: HttpInterceptor[]): Promise<void> {
    const router: express.Router & { key?: string | symbol } = express.Router({ mergeParams: true });

    for (const route of routes) {
      const routePath = route.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');
      router[route.method](routePath, async (req: express.Request, res: express.Response) => {
        await route.handlerFinalized!(
          req[WebSymbols.TravettoEntity] ??= ExpressWebServerUtil.getRequest(req),
          res[WebSymbols.TravettoEntity] ??= ExpressWebServerUtil.getResponse(res)
        );
      });
    }

    // Register options handler for each controller, working with a bug in express
    if (key !== WebSymbols.GlobalRoute) {
      const optionHandler = RouteUtil.createRouteHandler(
        interceptors,
        {
          method: 'options',
          path: '*all',
          handler: (__req: HttpRequest) => '',
          params: [{ extract: (__, r: unknown): unknown => r, location: 'context' }],
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
    return await WebNetUtil.listen(raw, this.config.port, this.config.bindAddress);
  }
}