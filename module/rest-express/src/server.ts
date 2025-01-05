import https from 'node:https';
import express from 'express';
import compression from 'compression';

import { Inject, Injectable } from '@travetto/di';
import { RestInterceptor, Request, RestConfig, RouteUtil, RestServer, RouteConfig, LoggingInterceptor, RestNetUtil } from '@travetto/rest';
import { GlobalRoute } from '@travetto/rest/src/internal/types';
import { TravettoEntitySymbol } from '@travetto/rest/src/internal/symbol';
import { ServerHandle } from '@travetto/rest/src/types';

import { RouteStack } from './internal/types';
import { ExpressServerUtil } from './internal/util';

/**
 * An express rest server
 */
@Injectable()
export class ExpressRestServer implements RestServer<express.Application> {

  raw: express.Application;

  listening: boolean;

  updateGlobalOnChange = true;

  @Inject()
  config: RestConfig;

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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const routes = (this.raw.router as unknown as { stack: RouteStack[] }).stack;
    const pos = routes.findIndex(x => x.handle.key === key);
    if (pos >= 0) {
      routes.splice(pos, 1);
    }
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[], interceptors: RestInterceptor[]): Promise<void> {
    const router: express.Router & { key?: string | symbol } = express.Router({ mergeParams: true });

    for (const route of routes) {
      const routePath = route.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');
      router[route.method](routePath, async (req: express.Request, res: express.Response) => {
        await route.handlerFinalized!(
          req[TravettoEntitySymbol] ??= ExpressServerUtil.getRequest(req),
          res[TravettoEntitySymbol] ??= ExpressServerUtil.getResponse(res)
        );
      });
    }

    // Register options handler for each controller, working with a bug in express
    if (key !== GlobalRoute) {
      const optionHandler = RouteUtil.createRouteHandler(
        interceptors,
        {
          method: 'options',
          path: '*all',
          handler: (__req: Request) => '',
          params: [{ extract: (__, r: unknown): unknown => r, location: 'context' }],
          interceptors: [
            [LoggingInterceptor, { disabled: true }]
          ]
        }
      );

      router.options('*all', (req: express.Request, res: express.Response) => {
        optionHandler(
          req[TravettoEntitySymbol] ??= ExpressServerUtil.getRequest(req),
          res[TravettoEntitySymbol] ??= ExpressServerUtil.getResponse(res)
        );
      });
    }

    router.key = key;
    this.raw.use(path, router);
  }

  async listen(): Promise<ServerHandle> {
    let raw: express.Application | https.Server = this.raw;
    if (this.config.ssl?.active) {
      const keys = await this.config.ssl?.getKeys();
      raw = https.createServer(keys!, this.raw);
    }
    this.listening = true;
    return await RestNetUtil.listen(raw, this.config.port, this.config.bindAddress);
  }
}