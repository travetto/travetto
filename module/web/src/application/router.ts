import { AppError, castTo, Class, Runtime, toConcrete, TypedObject } from '@travetto/runtime';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { RetargettingProxy, ChangeEvent } from '@travetto/registry';

import { ControllerRegistry } from '../registry/controller.ts';

import { WebInterceptor } from '../types/interceptor.ts';
import { WEB_INTERCEPTOR_CATEGORIES } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';
import { WebDispatcher, WebRouterSupport } from '../types/application.ts';

import { WebCommonUtil } from '../util/common.ts';
import { EndpointUtil } from '../util/endpoint.ts';
import { WebFilterContext } from '../types.ts';

/**
 * The web router
 */
@Injectable()
export class WebRouter implements WebDispatcher {

  #cleanup = new Map<string, Function | undefined>();

  @Inject()
  source: WebRouterSupport;

  /**
   * List of provided interceptors
   */
  interceptors: WebInterceptor[] = [];

  async postConstruct(): Promise<void> {
    this.interceptors = await this.getInterceptors();

    // Register all active
    await Promise.all(ControllerRegistry.getClasses()
      .map(c => this.registerController(c)));

    // Listen for updates
    ControllerRegistry.on(v => this.onControllerChange(v));
  }

  /**
   * Get the list of installed interceptors
   */
  async getInterceptors(): Promise<WebInterceptor[]> {
    const instances = await DependencyRegistry.getCandidateInstances(toConcrete<WebInterceptor>());
    const cats = WEB_INTERCEPTOR_CATEGORIES.map(x => ({
      key: x,
      start: castTo<Class<WebInterceptor>>({ name: `${x}Start` }),
      end: castTo<Class<WebInterceptor>>({ name: `${x}End` }),
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
    const config = ControllerRegistry.get(c);

    if (this.#cleanup.has(c.Ⲑid)) {
      throw new AppError(`Routes already exists for ${c.Ⲑid}, cannot re-register`, { category: 'general' });
    }

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

    const toClean = EndpointUtil.orderEndpoints(endpoints)
      .map(ep => {
        ep.instance = config.instance;
        ep.filter = castTo(EndpointUtil.createEndpointHandler(this.interceptors, ep, config));
        return this.source.register(ep);
      })
      .filter(x => !!x);

    if (toClean.length) {
      this.#cleanup.set(c.Ⲑid, () => toClean.forEach(x => x()));
    } else {
      this.#cleanup.set(c.Ⲑid, undefined);
    }

    console.debug('Registering Controller Instance', { id: config.class.Ⲑid, path: config.basePath, endpointCount: endpoints.length });
  }

  /**
   * Unregister a controller
   * @param c The class to unregister
   */
  async unregisterController(c: Class): Promise<void> {
    const cleanup = this.#cleanup.get(c.Ⲑid);
    if (cleanup) {
      cleanup();
      this.#cleanup.delete(c.Ⲑid);
    }
  }

  /**
   * Route and run the request
   */
  async dispatch(ctx: WebFilterContext): Promise<WebResponse> {
    return this.source.dispatch(ctx);
  }
}