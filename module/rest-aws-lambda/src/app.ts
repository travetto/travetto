import * as http from 'http';
import type * as lambda from 'aws-lambda';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';

import * as awsServerlessExpress from 'aws-serverless-express';
import * as awsServerlessExpressMiddleware from 'aws-serverless-express/middleware';

import { AppUtil } from '@travetto/app';
import { Inject } from '@travetto/di';
import { RestApp, RouteConfig, RouteUtil, TRV_RAW } from '@travetto/rest';

import { AwsLambdaConfig } from './config';
import { RouteStack } from './internal/types';

/**
 * Aws Lambda Rest App
 */
export class AwsLambdaRestApp extends RestApp<express.Application> {

  private server: http.Server;

  @Inject()
  private awsLambdaConfig: AwsLambdaConfig;

  private handler: (
    event: lambda.APIGatewayProxyEvent,
    context: lambda.Context
  ) => void;

  createRaw(): express.Application {
    const app = express();
    app.use(compression());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded());
    app.use(bodyParser.raw({ type: 'image/*' }));
    app.use(awsServerlessExpressMiddleware.eventContext());
    app.use((
      req: express.Request & { [TRV_RAW]?: express.Request },
      res: express.Response & { [TRV_RAW]?: express.Response },
      next
    ) => {
      req[TRV_RAW] = req;
      res[TRV_RAW] = res;
      next();
    });

    // Enable proxy for cookies
    if (this.config.trustProxy) {
      app.enable('trust proxy');
    }

    return app;
  }

  async init() {
    await super.init();
    this.server = awsServerlessExpress.createServer(this.raw);
    this.handler = (event, ctx) => awsServerlessExpress.proxy(this.server, event, ctx);
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
      router[route.method!](route.path!,
        // @ts-ignore
        route.handlerFinalized!);
    }

    // Register options handler for each controller
    if (key !== RestApp.GLOBAL) {
      const optionHandler = RouteUtil.createRouteHandler(this.interceptors,
        { method: 'options', path: '*', handler: this.globalHandler, params: [] });

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

  listen() {
    return {
      ...AppUtil.listenToCloseable(this.server),
      async wait() { } // Don't wait
    };
  }

  async handle(event: any, context: any) {
    if (!this.handler) {
      await this.run();
    }

    this.handler(event, context);
  }
}