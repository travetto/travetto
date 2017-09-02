import { ExpressConfig } from '../config';

import * as express from 'express';
import { Logger } from '@encore/log';
import { Filter, FilterPromise, PathType, Method, ControllerConfig, RouteStack } from '../model';
import { Injectable, DependencyRegistry } from '@encore/di';
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

  async postConstruct() {
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
    await Promise.all(Array.from(RouteRegistry.controllers.values())
      .map(c => this.registerController(c)));

    // Listen for updates
    RouteRegistry.events.on('reload', this.registerController.bind(this));

    this.app.use(RouteRegistry.errorHandler);

    if (this.config.serve && this.config.port > 0) {
      console.log(`Listening on ${this.config.port}`);
      this.app.listen(this.config.port);
    }
  }

  async registerController(config: ControllerConfig) {
    let instance = await DependencyRegistry.getInstance(config.class);

    if (this.controllers.has(config.path)) {
      console.log('Unregistering', config.path);
      this.app._router.stack = removeAllRoutes(this.app._router.stack, config);
    }
    console.log('Registering', config.path, config.handlers.length);
    for (let hconf of config.handlers) {
      hconf.instance = instance;
      this.app[hconf.method!](hconf.path!, ...hconf.filters!, hconf.handler);
    }
    this.controllers.set(config.path, config);
  }

  get() {
    return this.app;
  }
}