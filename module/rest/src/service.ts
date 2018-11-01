import { Injectable, DependencyRegistry, Inject } from '@travetto/di';
import { Class } from '@travetto/registry';
import { Util } from '@travetto/base';

import { RestConfig } from './config';
import { RestAppProvider, RestInterceptor, RestInterceptorSet } from './types';
import { ControllerRegistry } from './registry';
import { EndpointUtil } from './util/endpoint-util';

@Injectable()
export class RestApp {

  @Inject()
  private interceptorSet: RestInterceptorSet;

  @Inject()
  private config: RestConfig;

  constructor(
    public provider: RestAppProvider<any>,
  ) { }

  private async registerController(c: Class, interceptors: RestInterceptor[] = []) {
    const cConfig = ControllerRegistry.get(c);
    const controller = await DependencyRegistry.getInstance(cConfig.class);

    cConfig.instance = controller;
    for (const ep of cConfig.endpoints) {
      ep.instance = controller;
      ep.handlerFinalized = EndpointUtil.createEndpointHandler(cConfig, ep, interceptors);
    }

    return this.provider.registerController(cConfig);
  }

  async init() {
    await ControllerRegistry.init();

    await this.provider.init();

    const interceptors = DependencyRegistry.getCandidateTypes(RestInterceptor as Class)
      .filter(x => this.interceptorSet.interceptors.has(x.class));

    const instances = await Promise.all<RestInterceptor>(interceptors.map(op =>
      DependencyRegistry.getInstance(op.target, op.qualifier)
        .catch(err => {
          if ((err.message || '').includes('Cannot find module')) {
            console.error(`Unable to load operator ${op.class.name}#${op.qualifier.toString()}, module not found`);
          } else {
            throw err;
          }
        })
    ));

    const sorted = Util.computeOrdering(
      instances
        .map(x => ({
          key: x.constructor,
          before: x.before,
          after: x.after,
          target: x
        }))
    )
      .map(x => x.target);

    console.debug('Sorting interceptors', sorted.length, sorted.map(x => x.constructor.name));

    for (const inter of sorted) {
      this.provider.registerInterceptor(inter);
    }

    // Register all active
    await Promise.all(ControllerRegistry.getClasses()
      .map(c => this.registerController(c)));

    // Listen for updates
    ControllerRegistry.on(e => {
      console.trace('Registry event', e);
      if (e.prev && ControllerRegistry.hasExpired(e.prev)) {
        this.provider.unregisterController(ControllerRegistry.getExpired(e.prev)!);
      }
      if (e.curr) {
        this.registerController(e.curr!, sorted);
      }
    });
  }

  async run() {
    await this.init();
    console.info(`Listening on ${this.config.port}`);
    this.provider.listen(this.config.port);
  }
}