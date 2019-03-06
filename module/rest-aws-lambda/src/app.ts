import * as http from 'http';

import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';

import * as awsServerlessExpress from 'aws-serverless-express';
import * as awsServerlessExpressMiddleware from 'aws-serverless-express/middleware';

import { Inject } from '@travetto/di';
import { RestApp, RouteConfig } from '@travetto/rest';

import { AwsLambdaConfig } from './config';
import { RouteStack } from './types';

export class AwsLambdaRestApp extends RestApp<express.Application> {

  private server: http.Server;

  @Inject()
  private awsLambdaConfig: AwsLambdaConfig;

  private handler: (event: any, context: any) => void;

  createRaw(): express.Application {
    const app = express();
    app.use(compression());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded());
    app.use(bodyParser.raw({ type: 'image/*' }));
    app.use(cookieParser());
    app.use(awsServerlessExpressMiddleware.eventContext());

    // Enable proxy for cookies
    if (this.awsLambdaConfig.cookie.secure) {
      app.enable('trust proxy');
    }

    return app;
  }

  async init() {
    await super.init();
    this.server = awsServerlessExpress.createServer(this.raw);
    this.handler = awsServerlessExpress.proxy.bind(awsServerlessExpress, this.server) as any /** TODO: Typings seem off */;
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
    (router as any).key = key;
    this.raw.use(path, router);
  }

  listen() {
    // No-op
  }

  async handle(event: any, context: any) {
    if (!this.handler) {
      await this.run();
    }

    this.handler(event, context);
  }
}