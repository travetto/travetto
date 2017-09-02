import { ExpressConfig } from '../config';

import * as express from 'express';
import { Logger } from '@encore/log';
import { Filter, FilterPromise, PathType, Method, ControllerConfig, RouteStack } from '../model';
import { Injectable } from '@encore/di';
import { RouteRegistry } from './registry';
import { removeAllRoutes } from '../util';

let compression = require('compression');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let session = require('express-session');

@Injectable({ autoCreate: { create: true, priority: 1 } })
export class AppService {
  private app: express.Application;
  private controllers = new Map<string, ControllerConfig>();

  constructor(private config: ExpressConfig) {
  }

  postConstruct() {
    this.app = express();
    this.app.use(compression());
    this.app.use(cookieParser());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded());
    this.app.use(bodyParser.raw({ type: 'image/*' }));
    this.app.use(session(this.config.session)); // session secret

    //    import { requestContext } from '@encore/context/ext/express';
    //    .use(requestContext)

    // Enable proxy for cookies
    if (this.config.session.cookie.secure) {
      this.app.enable('trust proxy');
    }

    // Register all active
    for (let config of RouteRegistry.controllers.values()) {
      this.registerController(config);
    }

    // Listen for updates
    RouteRegistry.events.on('reload', this.registerController.bind(this));

    this.app.use(RouteRegistry.errorHandler);

    if (this.config.serve && this.config.port > 0) {
      console.log(`Listening on ${this.config.port}`);
      this.app.listen(this.config.port);
    }
  }

  registerController(config: ControllerConfig) {
    if (this.controllers.has(config.path)) {
      console.log('Unregistering', config.path);
      this.app._router.stack = removeAllRoutes(this.app._router.stack, config);
    }
    console.log('Registering', config.path, config.handlers.length);
    for (let { method, path, filters, handler } of config.handlers) {
      this.app[method!](path!, ...filters!, handler);
    }
    this.controllers.set(config.path, config);
  }

  get() {
    return this.app;
  }
}