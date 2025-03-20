import { Class, Runtime, toConcrete } from '@travetto/runtime';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { RetargettingProxy, ChangeEvent } from '@travetto/registry';
import { ConfigurationService } from '@travetto/config';

import { WebServerHandle } from '../types.ts';
import { EndpointUtil } from '../util/endpoint.ts';
import { HttpInterceptor, HttpInterceptorGroup } from '../interceptor/types.ts';
import { ControllerRegistry } from '../registry/controller.ts';
import { WebCommonUtil } from '../util/common.ts';

import { WebServer } from './server.ts';

/**
 * The web application
 */
@Injectable()
export class WebApplication<T = unknown> {

  @Inject()
  server: WebServer<T>;

  /**
   * List of provided interceptors
   */
  interceptors: HttpInterceptor[] = [];

  constructor() {
    this.onControllerChange = this.onControllerChange.bind(this);
  }

  async postConstruct(): Promise<void> {
    // Log on startup, before DI finishes
    const cfg = await DependencyRegistry.getInstance(ConfigurationService);
    await cfg.initBanner();

    await this.server.init();

    this.interceptors = await this.getInterceptors();

    // Register all active
    await Promise.all(ControllerRegistry.getClasses()
      .map(c => this.registerController(c)));

    // Listen for updates
    ControllerRegistry.on(this.onControllerChange);
  }

  /**
   * Get the list of installed interceptors
   */
  async getInterceptors(): Promise<HttpInterceptor[]> {
    const instances = await DependencyRegistry.getCandidateInstances(toConcrete<HttpInterceptor>());
    const groups = new Set<HttpInterceptorGroup>();
    const ordered = instances.map(x => {
      const after: Class<HttpInterceptor>[] = [];
      const before: Class<HttpInterceptor>[] = [];

      for (const item of x.runsBefore ?? []) {
        if (item instanceof HttpInterceptorGroup) {
          groups.add(item);
          before.push(item.start);
        } else {
          before.push(item);
        }
      }
      for (const item of x.dependsOn ?? []) {
        if (item instanceof HttpInterceptorGroup) {
          groups.add(item);
          before.push(item.end);
          after.push(item.start);
        } else {
          after.push(item);
        }
      }

      return ({ key: x.constructor, before, after, target: x, placeholder: false });
    });

    // Load groups into the ordering
    for (const group of groups) {
      ordered.push(
        {
          key: group.start,
          before: [group.end],
          after: [...group.dependsOn?.map(x => x.end) ?? []],
          placeholder: true,
          target: undefined!
        },
        {
          key: group.end,
          before: [...group.runsBefore?.map(x => x.start) ?? []],
          after: [group.start],
          placeholder: true,
          target: undefined!
        }
      );
    }

    const sorted = WebCommonUtil.ordered(ordered)
      .filter(x => !x.placeholder)  // Drop out the placeholders
      .map(x => x.target);

    console.debug('Sorting interceptors', { count: sorted.length, names: sorted.map(x => x.constructor.name) });
    return sorted;
  }

  /**
   * When a controller changes, unregister and re-register the class
   * @param e The change event
   */
  async onControllerChange(e: ChangeEvent<Class>): Promise<void> {
    console.debug('Registry event', { type: e.type, target: (e.curr ?? e.prev)?.Ⲑid });
    if (e.prev && ControllerRegistry.hasExpired(e.prev)) {
      await this.unregisterController(e.prev);
    }
    if (e.curr) {
      await this.registerController(e.curr!);
    }
  }

  /**
   * Register a controller
   * @param c The class to register
   */
  async registerController(c: Class): Promise<void> {
    if (this.server.listening && !Runtime.dynamic) {
      console.warn('Reloading only supported in dynamic mode');
      return;
    }

    const config = ControllerRegistry.get(c);

    // Skip registering conditional controllers
    if (config.conditional && !await config.conditional()) {
      return;
    }

    config.instance = await DependencyRegistry.getInstance(config.class);

    if (Runtime.dynamic) {
      config.instance = RetargettingProxy.unwrap(config.instance);
    }

    // Filter out conditional endpoints
    const endpoints = (await Promise.all(
      config.endpoints.map(ep => Promise.resolve(ep.conditional?.() ?? true).then(v => v ? ep : undefined))
    )).filter(x => !!x);

    if (!endpoints.length) {
      return;
    }

    for (const ep of EndpointUtil.orderEndpoints(endpoints)) {
      ep.instance = config.instance;
      ep.handlerFinalized = EndpointUtil.createEndpointHandler(this.interceptors, ep, config);
    }

    await this.server.registerEndpoints(config.class.Ⲑid, config.basePath, endpoints);

    console.debug('Registering Controller Instance', { id: config.class.Ⲑid, path: config.basePath, endpointCount: endpoints.length });
  }

  /**
   * Unregister a controller
   * @param c The class to unregister
   */
  async unregisterController(c: Class): Promise<void> {
    if (!Runtime.dynamic) {
      console.warn('Unloading only supported in dynamic mode');
      return;
    }

    await this.server.unregisterEndpoints(c.Ⲑid);
  }

  /**
   * Run the application
   */
  async run(): Promise<WebServerHandle> {
    const handle = await this.server.listen();
    if (handle.port) {
      console.log('Listening', { port: handle.port });
    }
    return handle;
  }
}