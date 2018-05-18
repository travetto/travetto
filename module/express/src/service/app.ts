import { ExpressConfig } from '../config';

import * as express from 'express';
import { RouteUtil } from '../util';
import { ControllerConfig } from '../model';
import { Injectable, DependencyRegistry } from '@travetto/di';
import { ControllerRegistry } from './registry';
import { ExpressOperator } from './operator';
import { Class } from '@travetto/registry';

@Injectable({ autoCreate: { create: true, priority: 1 } })
export class ExpressApp {

  private app: express.Application;
  private controllers = new Map<string, ControllerConfig>();

  constructor(private config: ExpressConfig) {
  }

  postConstruct() {
    // Wait for, need to wait for controller registry to be active,
    //  but can hold up di creation
    ControllerRegistry.init()
      .then(() => this.init());
  }

  async init() {
    const compression = require('compression');
    const cookieParser = require('cookie-parser');
    const bodyParser = require('body-parser');
    const session = require('express-session');

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

    const operators = DependencyRegistry.getCandidateTypes(ExpressOperator as Class);

    const instances = await Promise.all(operators.map(op =>
      DependencyRegistry.getInstance(ExpressOperator, op.qualifier)
        .catch(err => {
          console.log(`Unable to load operator ${op.class.name}#${op.qualifier.toString()}`);
        })
    ));

    const sorted = (instances
      .filter(x => !!x) as ExpressOperator[])
      .sort((a, b) => a.priority - b.priority);

    for (const inst of sorted) {
      inst.operate(this);
    }

    // Register all active
    await Promise.all(ControllerRegistry.getClasses()
      .map(c => this.registerController(ControllerRegistry.get(c))));

    // Listen for updates
    ControllerRegistry.on(e => {
      console.log('Registry event', e);
      if (e.prev && ControllerRegistry.hasExpired(e.prev)) {
        this.unregisterController(ControllerRegistry.getExpired(e.prev)!);
      }
      if (e.curr) {
        this.registerController(ControllerRegistry.get(e.curr!)!);
      }
    });

    this.app.use(RouteUtil.errorHandler);

    if (this.config.serve && this.config.port > 0) {
      console.log(`Listening on ${this.config.port}`);
      this.app.listen(this.config.port);
    }
  }

  async unregisterController(config: ControllerConfig) {
    console.log('Unregistering', config.class.__id, config.path);
    this.app._router.stack = RouteUtil.removeAllRoutes(this.app._router.stack, config);
  }

  async registerController(config: ControllerConfig) {
    const instance = await DependencyRegistry.getInstance(config.class);

    console.log('Registering Controller Instance', config.class.__id, config.path, config.handlers.length);

    for (const handler of config.handlers) {
      handler.filters = [...config.filters!, ...handler.filters!].map(RouteUtil.toPromise).map(x => RouteUtil.asyncHandler(x));
      handler.path = RouteUtil.buildPath(config.path, handler.path);
      handler.handler = RouteUtil.asyncHandler(
        RouteUtil.toPromise(handler.handler.bind(instance)),
        RouteUtil.outputHandler.bind(null, handler))
    }

    for (const hconf of config.handlers) {
      hconf.instance = instance;
      this.app[hconf.method!](hconf.path!, ...hconf.filters!, hconf.handler);
    }
    this.controllers.set(config.path, config);
  }

  get() {
    return this.app;
  }
}