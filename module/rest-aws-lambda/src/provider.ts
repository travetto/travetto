import * as http from 'http';

import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';

import * as awsServerlessExpress from 'aws-serverless-express';
import * as awsServerlessExpressMiddleware from 'aws-serverless-express/middleware';

import { ConfigLoader } from '@travetto/config';
import { ControllerConfig, RestAppProvider } from '@travetto/rest';

import { RouteStack } from './types';
import { AwsLambdaConfig } from './config';

export class RestAwsLambdaAppProvider extends RestAppProvider<express.Application> {

  private app: express.Application;
  private server: http.Server;
  private config: AwsLambdaConfig;
  private _handler: (event: any, context: any) => void;

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
    app.use(awsServerlessExpressMiddleware.eventContext());

    // Enable proxy for cookies
    if (this.config.cookie.secure) {
      app.enable('trust proxy');
    }

    return app;
  }

  async init() {
    this.config = new AwsLambdaConfig();
    ConfigLoader.bindTo(this.config, 'rest.awsLambda');

    this.app = this.create();

    this.app.use((req, res, next) =>
      this.executeInterceptors(req as any, res as any, next));

    this.server = awsServerlessExpress.createServer(this.app);
    this._handler = awsServerlessExpress.proxy.bind(awsServerlessExpress, this.server);
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

  listen() {
    // No-op
  }

  async handle(event: any, context: any) {
    if (!this._handler) {
      await this.init();
      this.listen();
    }

    this._handler(event, context);
  }
}