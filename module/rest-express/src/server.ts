import type * as https from 'https';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';

import { EnvUtil } from '@travetto/boot';
import { Injectable } from '@travetto/di';
import { RouteUtil, RestServer, ParamConfig, RouteConfig, RouteHandler, NodeRequestSym } from '@travetto/rest';
import { GlobalRoute } from '@travetto/rest/src/internal/types';

import { RouteStack } from './internal/types';

/**
 * An express rest server
 */
@Injectable()
export class ExpressRestServer extends RestServer<express.Application> {

  createRaw(): express.Application {
    const app = express();
    app.set('query parser', 'simple');
    app.use(compression());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.raw({ type: 'image/*' }));
    app.use((
      req: express.Request & { [NodeRequestSym]?: express.Request },
      res: express.Response & { [NodeRequestSym]?: express.Response },
      next) => {
      req[NodeRequestSym] = req; // Express objects match the framework structure
      res[NodeRequestSym] = res;
      next();
    });

    if (this.config.trustProxy) {
      app.enable('trust proxy');
    }

    return app;
  }

  async unregisterRoutes(key: string | symbol) {
    const routes = (this.raw._router.stack as RouteStack[]);
    const pos = routes.findIndex(x => x.handle.key === key);
    if (pos >= 0) {
      routes.splice(pos, 1);
    }
  }

  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]) {
    const router: express.Router & { key?: string | symbol } = express.Router({ mergeParams: true });

    for (const route of routes) {
      router[route.method as 'get'](route.path!,
        // @ts-ignore
        route.handlerFinalized!);
    }

    // Register options handler for each controller
    if (key !== GlobalRoute) {
      const optionHandler = RouteUtil.createRouteHandler(
        this.interceptors,
        {
          method: 'options',
          path: '*',
          handler: this.globalHandler as RouteHandler,
          params: [{ extract: (__, r: unknown) => r } as ParamConfig]
        }
      );

      // @ts-ignore
      router.options('*', optionHandler);
    }

    router.key = key;
    this.raw.use(path, router);

    if (this.listening && key !== GlobalRoute) {
      if (!EnvUtil.isReadonly()) {
        await this.unregisterGlobal();
      }
      await this.registerGlobal();
    }
  }

  async listen() {
    let raw: express.Application | https.Server = this.raw;
    if (this.config.ssl.active) {
      const keys = await this.config.getKeys();
      raw = (await import('https')).createServer(keys!, this.raw);
    }
    return raw.listen(this.config.port, this.config.bindAddress!);
  }
}