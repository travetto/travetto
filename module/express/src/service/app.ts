import { ExpressConfig } from '../config';

import * as express from 'express';
import { RouteUtil } from '../util';
import { ControllerConfig } from '../model';
import { Injectable, DependencyRegistry } from '@encore/di';
import { RouteRegistry } from './registry';
import { toPromise } from '@encore/base';
import { ExpressOperator } from './operator';

let compression = require('compression');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let session = require('express-session');

@Injectable({ autoCreate: { create: true, priority: 1 } })
export class ExpressApp {

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

    // Enable proxy for cookies
    if (this.config.session.cookie.secure) {
      this.app.enable('trust proxy');
    }

    let operators = DependencyRegistry.getCandidateTypes(ExpressOperator);
    console.log('Custom operators', operators);

    for (let op of operators) {
      try {
        let inst = await DependencyRegistry.getInstance(ExpressOperator, op.name);
        inst.operate(this);
      } catch (e) {
        console.log(`Unable to load operator ${op.class.name}#${op.name}`);
      }
    }

    // Register all active
    await Promise.all(Array.from(RouteRegistry.controllers.values())
      .map(c => this.registerController(c)));

    // Listen for updates
    RouteRegistry.events.on('reload', this.registerController.bind(this));

    this.app.use(RouteUtil.errorHandler);

    if (this.config.serve && this.config.port > 0) {
      console.log(`Listening on ${this.config.port}`);
      this.app.listen(this.config.port);
    }
  }

  async registerController(config: ControllerConfig) {
    let instance = await DependencyRegistry.getInstance(config.class);
    console.log(instance);

    console.log('Controller Instance', config.class.name, instance);

    for (let handler of config.handlers) {
      handler.filters = [...config.filters!, ...handler.filters!].map(toPromise).map(x => RouteUtil.asyncHandler(x));
      handler.path = RouteUtil.buildPath(config.path, handler.path);
      handler.handler = RouteUtil.asyncHandler(
        toPromise(handler.handler.bind(instance)),
        RouteUtil.outputHandler.bind(null, handler))
    }

    if (this.controllers.has(config.path)) {
      console.log('Unregistering', config.path);
      this.app._router.stack = RouteUtil.removeAllRoutes(this.app._router.stack, config);
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