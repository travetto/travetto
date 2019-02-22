import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';

import { ConfigLoader } from '@travetto/config';
import { RestConfig, ControllerConfig, RestAppProvider } from '@travetto/rest';

import { RouteStack } from './types';
import { ExpressConfig } from './config';

export class RestExpressAppProvider extends RestAppProvider<express.Application> {

  private app: express.Application;
  private config: ExpressConfig;

  get _raw() {
    return this.app;
  }

  create(): express.Application {
    const app = express();

    app.use(compression());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded());
    app.use(bodyParser.raw({ type: 'image/*' }));
    app.use(cookieParser());

    // Enable proxy for cookies
    if (this.config.cookie.secure) {
      app.enable('trust proxy');
    }

    return app;
  }

  async init() {
    this.config = new ExpressConfig();
    ConfigLoader.bindTo(this.config, 'rest.express');

    this.app = this.create();

    this.app.use((req, res, next) =>
      this.executeInterceptors(req as any, res as any, next));
  }

  async unregisterController(config: ControllerConfig) {
    const routes = (this.app._router.stack as RouteStack[]);
    const pos = routes.findIndex(x => x.handle.key === config.class.__id);
    routes.splice(pos, 1);
  }

  async registerController(cConfig: ControllerConfig) {
    const router = express.Router({ mergeParams: true });
    (router as any).key = cConfig.class.__id;

    for (const endpoint of cConfig.endpoints.reverse()) {
      router[endpoint.method!](endpoint.path!, endpoint.handlerFinalized! as any);
    }

    console.debug('Registering Controller Instance', cConfig.class.__id, cConfig.basePath, cConfig.endpoints.length);
    this.app.use(cConfig.basePath, router);
  }

  async listen(config: RestConfig) {
    if (config.ssl) {
      const https = await import('https');
      const keys = await config.getKeys();
      https.createServer(keys, this.app).listen(config.port);
    } else {
      this.app.listen(config.port);
    }
  }
}