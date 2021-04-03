import type * as https from 'https';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';

import { Inject, Injectable } from '@travetto/di';
import { RestInterceptor, Request, RestConfig, RouteUtil, RestServer, ParamConfig, RouteConfig } from '@travetto/rest';
import { GlobalRoute } from '@travetto/rest/src/internal/types';
import { NodeEntitySym } from '@travetto/rest/src/internal/symbol';

import { RouteStack } from './internal/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line no-shadow
    interface Request {
      [NodeEntitySym]?: express.Request;
    }
    interface Response {
      [NodeEntitySym]?: express.Response;
    }
  }
}

/**
 * An express rest server
 */
@Injectable()
export class ExpressRestServer implements RestServer<express.Application> {

  #raw: express.Application;

  listening: boolean;

  reregisterGlobalOnChange = true;

  @Inject()
  config: RestConfig;

  init(): express.Application {
    const app = express();
    app.set('query parser', 'simple');
    app.use(compression());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.raw({ type: 'image/*' }));
    app.use((req, res, next) => {
      req[NodeEntitySym] ??= req; // Express objects match the framework structure
      res[NodeEntitySym] ??= res;
      next();
    }
    );

    if (this.config.trustProxy) {
      app.enable('trust proxy');
    }

    this.#raw = app;

    return app;
  }

  async unregisterRoutes(key: string | symbol) {
    const routes = (this.#raw._router.stack as RouteStack[]);
    const pos = routes.findIndex(x => x.handle.key === key);
    if (pos >= 0) {
      routes.splice(pos, 1);
    }
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[], interceptors: RestInterceptor[]) {
    const router: express.Router & { key?: string | symbol } = express.Router({ mergeParams: true });

    for (const route of routes) {
      router[route.method as 'get'](route.path!,
        // @ts-ignore
        route.handlerFinalized!);
    }

    // Register options handler for each controller, working with a bug in express
    if (key !== GlobalRoute) {
      const optionHandler = RouteUtil.createRouteHandler(
        interceptors,
        {
          method: 'options',
          path: '*',
          handler: (__req: Request) => '',
          params: [{ extract: (__, r: unknown) => r } as ParamConfig]
        }
      );

      // @ts-ignore
      router.options('*', optionHandler);
    }

    router.key = key;
    this.#raw.use(path, router);
  }

  async listen() {
    let raw: express.Application | https.Server = this.#raw;
    if (this.config.ssl.active) {
      const keys = await this.config.getKeys();
      raw = (await import('https')).createServer(keys!, this.#raw);
    }
    this.listening = true;
    return raw.listen(this.config.port, this.config.bindAddress!);
  }
}