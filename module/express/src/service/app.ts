import * as express from 'express';

import { Env } from '@travetto/base';
import { Injectable, DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';

import { ExpressConfig } from '../config';
import { RouteUtil } from '../util';
import { ControllerConfig } from '../model';
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

    const instances = await Promise.all(operators.map(op =>
      DependencyRegistry.getInstance(op.target, op.qualifier)
        .catch(err => {
          console.error(`Unable to load operator ${op.class.name}#${op.qualifier.toString()}`);
        })
    ));

    const sorted = (instances
      .filter(x => !!x) as ExpressOperator[])
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
    console.debug('Unregistering', config.class.__id, config.path);
    this.app._router.stack = RouteUtil.removeAllRoutes(this.app._router.stack, config);
  }

  async registerController(cConfig: ControllerConfig) {
    const instance = await DependencyRegistry.getInstance(cConfig.class);

    console.debug('Registering Controller Instance', cConfig.class.__id, cConfig.path, cConfig.handlers.length);

    for (const hConfig of cConfig.handlers.reverse()) {
      hConfig.instance = instance;
      hConfig.path = RouteUtil.buildPath(cConfig.path, hConfig.path);
      hConfig.handler = RouteUtil.asyncHandler(
        RouteUtil.toPromise(hConfig.handler.bind(instance)),
        RouteUtil.outputHandler.bind(null, hConfig));

      const filters = [...cConfig.filters!, ...(hConfig.filters!).map(x => x.bind(instance))]
        .map(RouteUtil.toPromise)
        .map(x => RouteUtil.asyncHandler(x));

      this.app[hConfig.method!](hConfig.path!, ...filters, hConfig.handler);
    }

    this.controllers.set(cConfig.path, cConfig);
  }

  get() {
    return this.app;
  }
}