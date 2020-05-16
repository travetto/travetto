import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';

import { AppUtil } from '@travetto/app';
import { Injectable } from '@travetto/di';
import { RouteUtil, RestApp, ParamConfig, RouteConfig, RouteHandler, TRV_RAW } from '@travetto/rest';

import { RouteStack } from './internal/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      [TRV_RAW]: Request;
    }
    interface Response {
      [TRV_RAW]: Response;
    }
  }
}


/**
 * An express rest app
 */
@Injectable()
export class ExpressRestApp extends RestApp<express.Application> {

  createRaw(): express.Application {
    const app = express();

    app.use(compression());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded());
    app.use(bodyParser.raw({ type: 'image/*' }));
    app.use((req, res, next) => {
      req[TRV_RAW] = req; // Express objects match the framework structure
      res[TRV_RAW] = res;
      next();
    });

    if (this.config.trustProxy) {
      app.enable('trust proxy');
    }

    return app;
  }

  /**
   * Remove routes
   */
  async unregisterRoutes(key: string | symbol) {
    const routes = (this.raw._router.stack as RouteStack[]);
    const pos = routes.findIndex(x => x.handle.key === key);
    if (pos >= 0) {
      routes.splice(pos, 1);
    }
  }

  /**
   * Register or update routes
   */
  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]) {
    const router: express.Router & { key?: string | symbol } = express.Router({ mergeParams: true });

    for (const route of routes) {
      router[route.method!](route.path!,
        // @ts-ignore
        route.handlerFinalized!);
    }

    // Register options handler for each controller
    if (key !== RestApp.GLOBAL) {
      const optionHandler = RouteUtil.createRouteHandler(this.interceptors,
        {
          method: 'options', path: '*',
          handler: this.globalHandler as RouteHandler,
          params: [{ extract: (__, r: any) => r } as ParamConfig]
        });

      router.options('*',
        // @ts-ignore
        optionHandler);
    }

    router.key = key;
    this.raw.use(path, router);

    if (this.listening && key !== RestApp.GLOBAL) {
      await this.unregisterGlobal();
      await this.registerGlobal();
    }
  }

  /**
   * Listen to the application
   */
  async listen() {
    let server;
    if (this.config.ssl.active) {
      const https = await import('https');
      const keys = await this.config.getKeys();
      server = https.createServer(keys!, this.raw);
      server.listen(this.config.port, this.config.bindAddress);
    } else {
      server = this.raw.listen(this.config.port, this.config.bindAddress!);
    }
    return AppUtil.listenToCloseable(server);
  }
}