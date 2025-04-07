import { DependencyRegistry } from '@travetto/di';
import { RetargettingProxy } from '@travetto/registry';
import { castTo, Class, Runtime, toConcrete, TypedObject } from '@travetto/runtime';

import { EndpointConfig } from '../registry/types.ts';
import { ControllerRegistry } from '../registry/controller.ts';

import { WebInterceptor } from '../types/interceptor.ts';
import { WEB_INTERCEPTOR_CATEGORIES } from '../types/core.ts';
import { WebRouter } from '../types/application.ts';

import { WebCommonUtil } from './common.ts';
import { EndpointUtil } from './endpoint.ts';

/**
 * Standard utilities for working with the web router
 */
export class WebRouterUtil {

  static #compareEndpoints(a: number[], b: number[]): number {
    const al = a.length;
    const bl = b.length;
    if (al !== bl) {
      return bl - al;
    }
    let i = 0;
    while (i < al) {
      if (a[i] !== b[i]) {
        return b[i] - a[i];
      }
      i += 1;
    }
    return 0;
  }

  /**
   * Order endpoints by a set of rules, to ensure consistent registration and that precedence is honored
   */
  static orderEndpoints(endpoints: EndpointConfig[]): EndpointConfig[] {
    return endpoints
      .map(ep => {
        const parts = ep.path.replace(/^[/]|[/]$/g, '').split('/');
        return [ep, parts.map(x => /[*]/.test(x) ? 1 : /:/.test(x) ? 2 : 3)] as const;
      })
      .toSorted((a, b) => this.#compareEndpoints(a[1], b[1]) || a[0].path.localeCompare(b[0].path))
      .map(([ep, _]) => ep);
  }

  /**
   * Get all valid endpoints a for a given class
   */
  static async getValidEndpoints(c: Class): Promise<EndpointConfig[]> {
    const config = ControllerRegistry.get(c);

    // Skip registering conditional controllers
    if (config.conditional && !await config.conditional()) {
      return [];
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
      return [];
    }

    return this.orderEndpoints(endpoints);
  }

  /**
   * Get the list of installed interceptors
   */
  static async getInterceptors(): Promise<WebInterceptor[]> {
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

    return WebCommonUtil.ordered(ordered)
      .filter(x => !x.placeholder)  // Drop out the placeholders
      .map(x => x.target);
  }

  /**
   * Initialize router, encapsulating common patterns for standard router setup
   */
  static async initializeRouter(router: WebRouter): Promise<void> {
    const cleanup = new Map<string, Function>();
    const interceptors = await this.getInterceptors();

    const register = async (c: Class): Promise<void> => {
      const config = ControllerRegistry.get(c);
      const endpoints = await this.getValidEndpoints(c);
      for (const ep of endpoints) {
        ep.instance = config.instance;
        ep.filter = EndpointUtil.createEndpointHandler(interceptors, ep, config);
      }
      console.debug('Registering Controller Instance', { id: config.class.Ⲑid, path: config.basePath, endpointCount: endpoints.length });
      const fn = await router.register(endpoints, config);
      cleanup.set(c.Ⲑid, fn);
    };

    // Register all active
    for (const c of ControllerRegistry.getClasses()) {
      await register(c);
    }

    // Listen for updates
    ControllerRegistry.on(async e => {
      console.debug('Registry event', { type: e.type, target: (e.curr ?? e.prev)?.Ⲑid });
      if (e.prev && ControllerRegistry.hasExpired(e.prev)) {
        cleanup.get(e.prev.Ⲑid)?.();
        cleanup.delete(e.prev.Ⲑid);
      }
      if (e.curr) {
        await register(e.curr);
      }
    });

    console.debug('Sorting interceptors', { count: interceptors.length, names: interceptors.map(x => x.constructor.name) });
  }
}