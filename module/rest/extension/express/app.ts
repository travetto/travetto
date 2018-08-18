import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as compression from 'compression';

import { ConfigLoader } from '@travetto/config';

import { ControllerConfig, RestAppProvider, RestInterceptor } from '../../src';
import { RouteStack } from './types';
import { ExpressConfig } from './config';

export class ExpressAppProvider extends RestAppProvider<express.Application> {

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

    app.use(session(this.config)); // session secret

    // Enable proxy for cookies
    if (this.config.cookie.secure) {
      app.enable('trust proxy');
    }

    return app;
  }

  async init() {
    this.config = new ExpressConfig();
    ConfigLoader.bindTo(this.config, 'express');

    this.app = this.create();
  }

  async unregisterController(config: ControllerConfig) {
    this.app._router.stack = (this.app._router.stack as RouteStack[])
      .filter(x => x.handle.key === config.class.__id);
  }

  async registerController(cConfig: ControllerConfig) {
    const router = express.Router({ mergeParams: true });
    (router as any).key = cConfig.class.__id;

    for (const endpoint of cConfig.endpoints.reverse()) {
      router[endpoint.method!](endpoint.path!, endpoint.handlerFinalized!);
    }

    console.debug('Registering Controller Instance', cConfig.class.__id, cConfig.basePath, cConfig.endpoints.length);
    this.app.use(cConfig.basePath, router);
  }

  registerInterceptor(op: RestInterceptor) {
    this.app.use(op.intercept);
  }

  listen(port: number) {
    this.app.listen(port);
  }
}