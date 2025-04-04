// eslint-disable-next-line @typescript-eslint/naming-convention
import type Router from 'find-my-way';

import { AppError, castTo, Class, Runtime, toConcrete, TypedObject } from '@travetto/runtime';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { RetargettingProxy, ChangeEvent } from '@travetto/registry';
import { ConfigurationService } from '@travetto/config';

import { EndpointUtil } from '../util/endpoint.ts';
import { ControllerRegistry } from '../registry/controller.ts';
import { WebCommonUtil } from '../util/common.ts';

import { HttpInterceptor } from '../types/interceptor.ts';
import { HTTP_INTERCEPTOR_CATEGORIES, HTTP_METHODS, HttpMethod } from '../types/core.ts';
import { WebEndpointCleanup, WebServer, WebServerHandle } from '../types/server.ts';

/**
 * The web application
 */
@Injectable()
export class WebApplication<T = unknown> {

  #routeCleanup = new Map<string, WebEndpointCleanup>();

  @Inject()
  server: WebServer<T>;

  router: ReturnType<typeof Router>;

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

    this.server.registerRouter(req => {
      const found = this.router.find(req.method, req.url);
      if (!found) {
        throw new AppError('Unknown route');
      }
      return { endpoint: castTo(found.handler), params: found?.params };
    });

    // Listen for updates
    ControllerRegistry.on(this.onControllerChange);
  }

  /**
   * Get the list of installed interceptors
   */
  async getInterceptors(): Promise<HttpInterceptor[]> {
    const instances = await DependencyRegistry.getCandidateInstances(toConcrete<HttpInterceptor>());
    const cats = HTTP_INTERCEPTOR_CATEGORIES.map(x => ({
      key: x,
      start: castTo<Class<HttpInterceptor>>({ name: `${x}Start` }),
      end: castTo<Class<HttpInterceptor>>({ name: `${x}End` }),
    }));

    const categoryMapping = TypedObject.fromEntries(cats.map(x => [x.key, x]));

    const ordered = instances.map(x => {
      const group = categoryMapping[x.category];
      const after = [...x.dependsOn ?? [], group.start];
      const before = [...x.runsBefore ?? [], group.end];
      return ({ key: x.constructor, before, after, target: x, placeholder: false });
    });

    // Add category sets into the ordering
    let i = 0;
    for (const cat of cats) {
      const prevEnd = cats[i - 1]?.end ? [cats[i - 1].end] : [];
      ordered.push(
        { key: cat.start, before: [cat.end], after: prevEnd, placeholder: true, target: undefined! },
        { key: cat.end, before: [], after: [cat.start], placeholder: true, target: undefined! }
      );
      i += 1;
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
    if (this.#routeCleanup.get(c.Ⲑid) === null) {
      console.warn('Reloading routes not supported for ', this.server.constructor.Ⲑid);
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
      ep.filter = castTo(EndpointUtil.createEndpointHandler(this.interceptors, ep, config));
    }

    const toClean: [HttpMethod, string][] = [];
    for (const endpoint of endpoints) {
      const fullPath = endpoint.fullPath.replace(/[*][^*]+/g, '*'); // Flatten wildcards
      this.router[HTTP_METHODS[endpoint.method].lower](fullPath, castTo(endpoint.filter!));
      toClean.push([endpoint.method, fullPath]);
    }

    this.#routeCleanup.set(c.Ⲑid, async () => {
      for (const [method, path] of toClean) {
        this.router.off(method, path);
      }
    });

    console.debug('Registering Controller Instance', { id: config.class.Ⲑid, path: config.basePath, endpointCount: endpoints.length });
  }

  /**
   * Unregister a controller
   * @param c The class to unregister
   */
  async unregisterController(c: Class): Promise<void> {
    this.#routeCleanup.get(c.Ⲑid)?.();
    this.#routeCleanup.delete(c.Ⲑid);
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