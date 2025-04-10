import { Class, toConcrete } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';

import { ControllerConfig, EndpointConfig } from '../registry/types.ts';
import { ControllerRegistry } from '../registry/controller.ts';

import { WebRouter } from '../types/router.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebResponse } from '../types/response.ts';
import { WebFilterContext } from '../types.ts';

import { EndpointUtil } from '../util/endpoint.ts';

/**
 * Supports the base pattern for the most common web router implementations
 */
export abstract class BaseWebRouter implements WebRouter {

  #cleanup = new Map<string, Function>();
  #interceptors: WebInterceptor[];

  async #register(c: Class): Promise<void> {
    const config = ControllerRegistry.get(c);

    let endpoints = await EndpointUtil.getBoundEndpoints(c);
    endpoints = EndpointUtil.orderEndpoints(endpoints);

    for (const ep of endpoints) {
      ep.filter = EndpointUtil.createEndpointHandler(this.#interceptors, ep, config);
    }

    console.debug('Registering Controller Instance', { id: config.class.Ⲑid, path: config.basePath, endpointCount: endpoints.length });
    const fn = await this.register(endpoints, config);
    this.#cleanup.set(c.Ⲑid, fn);
  };

  /**
   * Initialize router, encapsulating common patterns for standard router setup
   */
  async postConstruct(): Promise<void> {

    this.#interceptors = await DependencyRegistry.getCandidateInstances(toConcrete<WebInterceptor>());
    this.#interceptors = EndpointUtil.orderInterceptors(this.#interceptors);
    const names = this.#interceptors.map(x => x.constructor.name);
    console.debug('Sorting interceptors', { count: names.length, names });

    // Register all active
    for (const c of ControllerRegistry.getClasses()) {
      await this.#register(c);
    }

    // Listen for updates
    ControllerRegistry.on(async e => {
      console.debug('Registry event', { type: e.type, target: (e.curr ?? e.prev)?.Ⲑid });
      if (e.prev && ControllerRegistry.hasExpired(e.prev)) {
        this.#cleanup.get(e.prev.Ⲑid)?.();
        this.#cleanup.delete(e.prev.Ⲑid);
      }
      if (e.curr) {
        await this.#register(e.curr);
      }
    });
  }

  abstract register(endpoints: EndpointConfig[], controller: ControllerConfig): Promise<() => void>;
  abstract dispatch(ctx: WebFilterContext): Promise<WebResponse>;
}