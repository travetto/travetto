import * as express from 'express';

import { Env } from '@travetto/base';
import { Injectable, DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';

import { ExpressConfig } from '../config';
import { RouteUtil } from '../util';
import { ControllerConfig } from '../service';
import { ControllerRegistry } from './registry';
import { ExpressOperator } from './operator';

@Injectable({ autoCreate: { create: Env.is('express'), priority: 1 } })
export class ExpressApp {

  private app: express.Application;
  private controllers = new Map<string, ControllerConfig>();

  constructor(private config: ExpressConfig) {
  }

  async postConstruct() {
    await ControllerRegistry.init();
    return this.init();
  }

  async init() {
    this.app = express();

    const operators = DependencyRegistry.getCandidateTypes(ExpressOperator as Class);

    const instances = await Promise.all<ExpressOperator>(operators.map(op =>
      DependencyRegistry.getInstance(op.target, op.qualifier)
        .catch(err => {
          console.error(`Unable to load operator ${op.class.name}#${op.qualifier.toString()}`);
        })
    ));

    const sorted = instances
      .filter(x => !!x)
      .sort((a, b) => a.priority - b.priority);

    console.log('Sorting Operators', sorted.length);

    for (const inst of sorted) {
      inst.operate(this);
    }

    // Register all active
    await Promise.all(ControllerRegistry.getClasses()
      .map(c => this.registerController(ControllerRegistry.get(c))));

    // Listen for updates
    ControllerRegistry.on(e => {
      console.trace('Registry event', e);
      if (e.prev && ControllerRegistry.hasExpired(e.prev)) {
        this.unregisterController(ControllerRegistry.getExpired(e.prev)!);
      }
      if (e.curr) {
        this.registerController(ControllerRegistry.get(e.curr!)!);
      }
    });

    this.app.use(RouteUtil.errorHandler);

    if (this.config.serve && this.config.port > 0) {
      console.info(`Listening on ${this.config.port}`);
      this.app.listen(this.config.port);
    }
  }

  async unregisterController(config: ControllerConfig) {
    console.debug('Unregistering', config.class.__id, config.basePath);
    this.app._router.stack = RouteUtil.removeAllRoutes(this.app._router.stack, config);
  }

  async registerController(cConfig: ControllerConfig) {
    const instance = await DependencyRegistry.getInstance(cConfig.class);
    cConfig.instance = instance;

    console.debug('Registering Controller Instance', cConfig.class.__id, cConfig.basePath, cConfig.endpoints.length);

    for (const endpoint of cConfig.endpoints.reverse()) {
      endpoint.instance = instance;
      endpoint.path = RouteUtil.buildPath(cConfig.basePath, endpoint.path);
      endpoint.handler = RouteUtil.asyncHandler(
        RouteUtil.toPromise(endpoint.handler.bind(instance)),
        RouteUtil.outputHandler.bind(null, endpoint));

      const filters = [...cConfig.filters, ...(endpoint.filters).map(x => x.bind(instance))]
        .map(RouteUtil.toPromise)
        .map(x => RouteUtil.asyncHandler(x));

      this.app[endpoint.method!](endpoint.path!, ...filters, endpoint.handler);
    }

    this.controllers.set(cConfig.basePath, cConfig);
  }

  get() {
    return this.app;
  }
}