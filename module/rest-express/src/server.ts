import type * as https from 'https';
import * as express from 'express';
import * as compression from 'compression';

import { Inject, Injectable } from '@travetto/di';
import { RestInterceptor, Request, RestConfig, RouteUtil, RestServer, RouteConfig } from '@travetto/rest';
import { GlobalRoute } from '@travetto/rest/src/internal/types';
import { NodeEntityⲐ, TravettoEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { ServerHandle } from '@travetto/rest/src/types';

import { RouteStack } from './internal/types';
import { ExpressServerUtil } from './internal/util';

// Support typings
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line no-shadow
    interface Request {
      [TravettoEntityⲐ]?: TravettoRequest;
      [NodeEntityⲐ]?: express.Request;
    }
    interface Response {
      [TravettoEntityⲐ]?: TravettoResponse;
      [NodeEntityⲐ]?: express.Response;
    }
  }
}

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

  init(): express.Application {
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
    const routes: RouteStack[] = this.raw._router.stack;
    const pos = routes.findIndex(x => x.handle.key === key);
    if (pos >= 0) {
      routes.splice(pos, 1);
    }
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[], interceptors: RestInterceptor[]): Promise<void> {
    const router: express.Router & { key?: string | symbol } = express.Router({ mergeParams: true });

    for (const route of routes) {
      router[route.method](route.path!, (req, res) => {
        route.handlerFinalized!(
          req[TravettoEntityⲐ] ??= ExpressServerUtil.getRequest(req),
          res[TravettoEntityⲐ] ??= ExpressServerUtil.getResponse(res)
        );
      });
    }

    // Register options handler for each controller, working with a bug in express
    if (key !== GlobalRoute) {
      const optionHandler = RouteUtil.createRouteHandler(
        interceptors,
        {
          method: 'options',
          path: '*',
          handler: (__req: Request) => '',
          params: [{ extract: (__, r: unknown) => r, location: 'context' }]
        }
      );

      router.options('*', (req, res) => {
        optionHandler(
          req[TravettoEntityⲐ] ??= ExpressServerUtil.getRequest(req),
          res[TravettoEntityⲐ] ??= ExpressServerUtil.getResponse(res)
        );
      });
    }

    router.key = key;
    this.raw.use(path, router);
  }

  async listen(): Promise<ServerHandle> {
    let raw: express.Application | https.Server = this.raw;
    if (this.config.ssl.active) {
      const keys = await this.config.getKeys();
      raw = (await import('https')).createServer(keys!, this.raw);
    }
    this.listening = true;
    return raw.listen(this.config.port, this.config.bindAddress!);
  }
}