import * as http from 'http';
import type * as lambda from 'aws-lambda';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';

import * as awsServerlessExpress from 'aws-serverless-express';
import * as awsServerlessExpressMiddleware from 'aws-serverless-express/middleware';

import { AppUtil } from '@travetto/app';
import { Inject } from '@travetto/di';
import { RestServer, RouteConfig, RouteUtil, TRV_RAW } from '@travetto/rest';

import { AwsLambdaConfig } from './config';

/**
 * Aws Lambda Rest Server
 */
export class AwsLambdaRestServer extends RestServer<express.Application> {

  private server: http.Server;

  @Inject()
  private awsLambdaConfig: AwsLambdaConfig;

  /**
   * Handler method for the proxy, will get initialized on first request
   */
  private handler: (
    event: lambda.APIGatewayProxyEvent,
    context: lambda.Context
  ) => void;

  /**
   * Create the raw handler using the aws serverless framework
   */
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

  /**
   * Initialize handler
   */
  async init() {
    await super.init();
    this.server = awsServerlessExpress.createServer(this.raw);
    this.handler = (event, ctx) => awsServerlessExpress.proxy(this.server, event, ctx);
  }

  /**
   * Remove routes, does not work for aws
   */
  async unregisterRoutes(key: string | symbol) {
    console.debug('Reloading not supported in aws lambda');
  }

  /**
   * Register routes during install, live reload will not work
   */
  async registerRoutes(key: string | symbol, path: string, routes: RouteConfig[]) {
    if (this.listening) {
      console.warn('Reloading not supported in aws lambda');
      return;
    }
    const router: express.Router & { key?: string | symbol } = express.Router({ mergeParams: true });

    for (const route of routes) {
      router[route.method as 'get'](route.path!,
        // @ts-ignore
        route.handlerFinalized!);
    }

    // Register options handler for each controller
    if (key !== RestServer.GLOBAL) {
      const optionHandler = RouteUtil.createRouteHandler(this.interceptors, {
        method: 'options', path: '*', handler: this.globalHandler, params: []
      });

      router.options('*',
        // @ts-ignore
        optionHandler);
    }

    router.key = key;
    this.raw.use(path, router);

    if (this.listening && key !== RestServer.GLOBAL) {
      await this.unregisterGlobal();
      await this.registerGlobal();
    }
  }

  /**
   * Listen for the application to close, don't wait up
   */
  listen() {
    return {
      ...AppUtil.listenToCloseable(this.server),
      async wait() { } // Don't wait
    };
  }

  /**
   * Handle the inbound event, context
   */
  async handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
    if (!this.handler) {
      await this.run(); // Initialize the app if not setup
    }

    this.handler(event, context);
  }
}