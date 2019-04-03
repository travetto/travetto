import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';

import { Injectable } from '@travetto/di';
import { RouteUtil, RestApp, RouteConfig } from '@travetto/rest';

import { RouteStack } from './types';

@Injectable()
export class ExpressRestApp extends RestApp<express.Application> {

  createRaw(): express.Application {
    const app = express();

    app.use(compression());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded());
    app.use(bodyParser.raw({ type: 'image/*' }));
    app.use((req, res, next) => {
      (req as any).__raw = req;
      (res as any).__raw = res;
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
    const router = express.Router({ mergeParams: true });

    for (const route of routes) {
      router[route.method!](route.path!, route.handlerFinalized! as any);
    }

    // Register options handler for each controller
    if (key !== RestApp.GLOBAL) {
      const optionHandler = RouteUtil.createRouteHandler(this.interceptors,
        { method: 'options', path: '*', handler: this.globalHandler });

      router.options('*', optionHandler as any);
    }

    (router as any).key = key;
    this.raw.use(path, router);

    if (this.listening && key !== RestApp.GLOBAL) {
      await this.unregisterGlobal();
      await this.registerGlobal();
    }
  }

  async listen() {
    if (this.config.ssl.active) {
      const https = await import('https');
      const keys = await this.config.getKeys();
      https.createServer(keys!, this.raw).listen(this.config.port);
    } else {
      this.raw.listen(this.config.port);
    }
  }
}