import * as express from 'express';

import { Injectable, DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';
import { Util } from '@travetto/base';

import { ExpressConfig } from './config';
import { RouteUtil } from '../route-util';
import { ControllerConfig, ExpressOperator, ExpressOperatorSet } from '../types';
import { ControllerRegistry } from './registry';

@Injectable()
export class ExpressApp {

  private instance: express.Application;
  private controllers = new Map<string, ControllerConfig>();

  constructor(private config: ExpressConfig, private operatorSet: ExpressOperatorSet) {
  }

  private async unregisterController(config: ControllerConfig) {
    console.debug('Un-registering', config.class.__id, config.basePath);
    this.instance._router.stack = RouteUtil.removeAllRoutes(this.instance._router.stack, config);
  }

  private async registerController(cConfig: ControllerConfig) {
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

      this.instance[endpoint.method!](endpoint.path!, ...filters, endpoint.handler);
    }

    this.controllers.set(cConfig.basePath, cConfig);
  }

  get() {
    return this.instance;
  }

  async init() {
    await ControllerRegistry.init();

    this.instance = express();

    const operators = DependencyRegistry.getCandidateTypes(ExpressOperator as Class)
      .filter(x => this.operatorSet.operators.has(x.class));

    const instances = await Promise.all<ExpressOperator>(operators.map(op =>
      DependencyRegistry.getInstance(op.target, op.qualifier)
        .catch(err => {
          console.error(`Unable to load operator ${op.class.name}#${op.qualifier.toString()}`);
        })
    ));

    const sorted = Util.computeOrdering(instances.map(x => ({
      key: x.constructor,
      before: x.before,
      after: x.after,
      target: x
    }))).map(x => x.target);

    console.log('Sorting Operators', sorted.length, sorted.map(x => x.constructor.name));

    for (const inst of sorted) {
      inst.operate(this.instance);
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

    this.instance.use(RouteUtil.errorHandler);
  }

  async run() {
    await this.init();
    console.info(`Listening on ${this.config.port}`);
    this.instance.listen(this.config.port);
  }
}