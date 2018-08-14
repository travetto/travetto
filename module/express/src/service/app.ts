import * as express from 'express';

import { Injectable, DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';
import { Util } from '@travetto/base';

import { ExpressConfig } from './config';
import { RouteUtil } from '../route-util';
import { ControllerConfig, ExpressOperator, ExpressOperatorSet, RouteStack } from '../types';
import { ControllerRegistry } from './registry';

@Injectable()
export class ExpressApp {

  private app: express.Application;
  private controllers = new Map<string, ControllerConfig>();

  constructor(private config: ExpressConfig, private operatorSet: ExpressOperatorSet) {
  }

  private async unregisterController(config: ControllerConfig) {
    this.app._router.stack = (this.app._router.stack as RouteStack[])
      .filter(x => x.handle.key === config.class.__id);
  }

  private async registerController(cConfig: ControllerConfig) {
    const controller = await DependencyRegistry.getInstance(cConfig.class);
    cConfig.instance = controller;

    const router = express.Router({ mergeParams: true });
    (router as any).key = cConfig.class.__id;

    for (const endpoint of cConfig.endpoints.reverse()) {
      endpoint.instance = controller;
      router[endpoint.method!](endpoint.path!, RouteUtil.createRouteHandler(cConfig, endpoint));
    }

    console.debug('Registering Controller Instance', cConfig.class.__id, cConfig.basePath, cConfig.endpoints.length);
    this.app.use(cConfig.basePath, router);

    this.controllers.set(cConfig.basePath, cConfig);
  }

  get() {
    return this.app;
  }

  async init() {
    await ControllerRegistry.init();

    this.app = express();

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
      inst.operate(this.app);
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
  }

  async run() {
    await this.init();
    console.info(`Listening on ${this.config.port}`);
    this.app.listen(this.config.port);
  }
}